import React, { useEffect, useState, useRef } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  onSnapshot,
  updateDoc,
  addDoc,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBzM9MXxjIWZE87TrltYF2wcohrrBakcCk",
  authDomain: "omeletaz.firebaseapp.com",
  projectId: "omeletaz",
  storageBucket: "omeletaz.appspot.com",
  messagingSenderId: "695588704686",
  appId: "1:695588704686:web:bf98c0176515378f07783f",
  measurementId: "G-0XXE7YQ603",
};

const app = initializeApp(firebaseConfig);
const firestore = getFirestore(app);



const App = () => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream] = useState(new MediaStream());

  const webcamVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const callInputRef = useRef(null);
  const pc = useRef(null); // Initialize as null

  useEffect(() => {
    return () => {
      if (pc.current) {
        pc.current.close(); // Clean up the peer connection on unmount
      }
    };
  }, []);

  const startWebcam = async () => {
    if (pc.current) {
      pc.current.close(); // Close existing connection if it exists
    }

    pc.current = new RTCPeerConnection({
      iceServers: [
        {
          urls: ["stun:stun.l.google.com:19302", "stun:stun.l.google.com:5349"],
        },
      ],
    });

    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });
    setLocalStream(stream);
    webcamVideoRef.current.srcObject = stream;

    stream.getTracks().forEach((track) => {
      pc.current.addTrack(track, stream);
    });

    remoteVideoRef.current.srcObject = remoteStream;

    pc.current.ontrack = (event) => {
      console.log("Track event received");
      event.streams[0].getTracks().forEach((track) => {
        remoteStream.addTrack(track);
      });
    };
  };

  const createCall = async (matchedUserId) => {
    console.log("Creating call for matched user:", matchedUserId);
    
    // Ensure matchedUserId is a valid string
    if (typeof matchedUserId !== 'string') {
      console.error("Invalid matchedUserId:", matchedUserId);
      return; // Exit the function early if it's invalid
    }
  
    if (!pc.current || pc.current.signalingState === "closed") {
      console.log("Creating new RTCPeerConnection");
      pc.current = new RTCPeerConnection({
        iceServers: [
          {
            urls: [
              "stun:stun.l.google.com:19302",
              "stun:stun.l.google.com:5349",
            ],
          },
        ],
      });
  
      remoteVideoRef.current.srcObject = remoteStream;
  
      pc.current.ontrack = (event) => {
        console.log("Track event received");
        event.streams[0].getTracks().forEach((track) => {
          remoteStream.addTrack(track);
        });
      };
    }
  
    const callDocRef = doc(collection(firestore, "calls")); // Create a Firestore document for the call
    const offerCandidates = collection(callDocRef, "offerCandidates");
    const answerCandidates = collection(callDocRef, "answerCandidates");
  
    try {
      // Check if matchedUserId exists
      if (matchedUserId) {
        await setDoc(doc(firestore, "users", matchedUserId), {
          callId: callDocRef.id,
        });
        console.log(`Setting call ID for matched user: ${matchedUserId}`);
      }
  
      pc.current.onicecandidate = (event) => {
        if (event.candidate) {
          console.log("New ICE candidate");
          addDoc(offerCandidates, event.candidate.toJSON());
        }
      };
  
      const offerDescription = await pc.current.createOffer();
      await pc.current.setLocalDescription(offerDescription);
      console.log("Local description set:", offerDescription);
  
      await setDoc(callDocRef, {
        offer: { sdp: offerDescription.sdp, type: offerDescription.type },
      });
  
      onSnapshot(callDocRef, (snapshot) => {
        const data = snapshot.data();
        if (pc.current.currentRemoteDescription === null && data?.answer) {
          const answerDescription = new RTCSessionDescription(data.answer);
          pc.current.setRemoteDescription(answerDescription);
          console.log("Remote description set");
        }
      });
  
      onSnapshot(answerCandidates, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            const candidate = new RTCIceCandidate(change.doc.data());
            pc.current.addIceCandidate(candidate);
            console.log("Added ICE candidate");
          }
        });
      });
    } catch (error) {
      console.error("Error creating call:", error);
    }
  };

  const answerCall = async () => {
    const callId = callInputRef.current.value;

    if (!callId) {
      console.error("Call ID not found!");
      return;
    }

    const callDocRef = doc(firestore, "calls", callId);
    const answerCandidates = collection(callDocRef, "answerCandidates");

    pc.current.onicecandidate = (event) => {
      if (event.candidate) {
        addDoc(answerCandidates, event.candidate.toJSON());
        console.log("New ICE candidate added in answerCall");
      }
    };

    const callData = (await getDoc(callDocRef)).data();
    const offerDescription = callData.offer;

    await pc.current.setRemoteDescription(
      new RTCSessionDescription(offerDescription)
    );
    const answerDescription = await pc.current.createAnswer();
    await pc.current.setLocalDescription(answerDescription);

    await updateDoc(callDocRef, {
      answer: { type: answerDescription.type, sdp: answerDescription.sdp },
    });

    onSnapshot(collection(callDocRef, "offerCandidates"), (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const candidate = new RTCIceCandidate(change.doc.data());
          pc.current.addIceCandidate(candidate);
          console.log("Added ICE candidate in answerCall");
        }
      });
    });
  };

  const joinLobby = async () => {
    const lobbyRef = collection(firestore, "lobby");
  
    // Add the current user to the lobby
    const userDocRef = await addDoc(lobbyRef, { status: "waiting" });
  
    // Listen for changes in the lobby to find a match
    const unsubscribe = onSnapshot(lobbyRef, async (snapshot) => {
      const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
      // Find a match: If there's another user waiting, connect them
      if (users.length > 1) {
        const matchedUser = users.find(user => user.id !== userDocRef.id); // Find another user
        if (matchedUser) {
          // Remove both users from the lobby
          await deleteDoc(doc(lobbyRef, userDocRef.id));
          await deleteDoc(doc(lobbyRef, matchedUser.id));
          
          console.log("Match found:", matchedUser.id);
          // Pass matchedUser.id to createCall instead of the event
          await createCall(matchedUser.id); // Call the matched user
          unsubscribe(); // Stop listening once matched
        }
      }
    });
  };
  
  const findMatch = async () => {
    await joinLobby(); // Call function to join the lobby and listen for a match
  };

  return (
    <>
      <h1>OmeleTaz</h1>
      <h3>Your Favorite ChatApp</h3>
      <div className="videos">
        <video ref={webcamVideoRef} autoPlay playsInline></video>
        <video ref={remoteVideoRef} autoPlay playsInline></video>
      </div>
      <button onClick={startWebcam}>Start Webcam</button>
      <h2>Create a new call</h2>
      <button onClick={findMatch}>Find Match</button>
      <h2>Join a Call</h2>
      <input ref={callInputRef} />
    </>
  );
};

export default App;
