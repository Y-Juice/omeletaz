import style from "./App.css";

import React, { useEffect, useState, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, getDoc, onSnapshot, updateDoc, addDoc } from "firebase/firestore";
import copyIcon from "./icons/copy.png";


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
      // If pc already exists, reset it
      pc.current.close();
    }

    pc.current = new RTCPeerConnection({
      iceServers: [
        {
          urls: ["stun:stun.l.google.com:19302", "stun:stun.l.google.com:5349"],
        },
      ],
    });

    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    setLocalStream(stream);
    webcamVideoRef.current.srcObject = stream;

    stream.getTracks().forEach((track) => {
      pc.current.addTrack(track, stream);
    });

    remoteVideoRef.current.srcObject = remoteStream;

    pc.current.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => {
        remoteStream.addTrack(track);
      });
    };
  };

  const createCall = async () => {
    const callDocRef = doc(collection(firestore, "calls")); // Create a document reference
    const offerCandidates = collection(callDocRef, "offerCandidates");
    const answerCandidates = collection(callDocRef, "answerCandidates");

    callInputRef.current.value = callDocRef.id;

    pc.current.onicecandidate = (event) => {
      if (event.candidate) {
        addDoc(offerCandidates, event.candidate.toJSON());
      }
    };

    const offerDescription = await pc.current.createOffer();
    await pc.current.setLocalDescription(offerDescription);
    await setDoc(callDocRef, { offer: { sdp: offerDescription.sdp, type: offerDescription.type } });

    onSnapshot(callDocRef, (snapshot) => {
      const data = snapshot.data();
      if (pc.current.currentRemoteDescription === null && data?.answer) {
        const answerDescription = new RTCSessionDescription(data.answer);
        pc.current.setRemoteDescription(answerDescription);
      }
    });

    onSnapshot(answerCandidates, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const candidate = new RTCIceCandidate(change.doc.data());
          pc.current.addIceCandidate(candidate);
        }
      });
    });
  };

  const answerCall = async () => {
    const callId = callInputRef.current.value;
    const callDocRef = doc(firestore, "calls", callId); // Access the document directly
    const answerCandidates = collection(callDocRef, "answerCandidates");
    const offerCandidates = collection(callDocRef, "offerCandidates");

    pc.current.onicecandidate = (event) => {
      if (event.candidate) {
        addDoc(answerCandidates, event.candidate.toJSON());
      }
    };

    const callData = (await getDoc(callDocRef)).data(); // Get the call document data
    const offerDescription = callData.offer;

    await pc.current.setRemoteDescription(new RTCSessionDescription(offerDescription));
    const answerDescription = await pc.current.createAnswer();
    await pc.current.setLocalDescription(answerDescription);

    await updateDoc(callDocRef, { answer: { type: answerDescription.type, sdp: answerDescription.sdp } });

    onSnapshot(offerCandidates, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const data = change.doc.data();
          pc.current.addIceCandidate(new RTCIceCandidate(data));
        }
      });
    });
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
      <button onClick={createCall}>Call</button>
      <h2>Join a Call</h2>
      <input ref={callInputRef} />

      <button id="copyBtn" onClick={answerCall}><img src={copyIcon}/></button>
      <button onClick={answerCall}>Answer</button>
    </>
  );
};

export default App;
