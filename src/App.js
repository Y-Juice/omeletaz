import "./App.css";
import React, { useEffect, useState, useRef } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  updateDoc,
  addDoc,
} from "firebase/firestore";
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
  const pc = useRef(null);

  useEffect(() => {
    return () => {
      if (pc.current) {
        pc.current.close();
      }
    };
  }, []);

  const startWebcam = async () => {
    if (pc.current) {
      pc.current.close();
    }

    pc.current = new RTCPeerConnection({
      iceServers: [
        {
          urls: [
            "stun:stun.l.google.com:19302",
            "stun:stun1.l.google.com:19302",
          ],
        },
      ],
    });

    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    setLocalStream(stream);
    webcamVideoRef.current.srcObject = stream;

    stream.getTracks().forEach((track) => {
      pc.current.addTrack(track, stream);
    });

    pc.current.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => {
        remoteStream.addTrack(track);
      });
    };

    remoteVideoRef.current.srcObject = remoteStream;
  };

  const createCall = async () => {
    const callDocRef = doc(collection(firestore, "calls"));
    const offerCandidates = collection(callDocRef, "offerCandidates");
    const answerCandidates = collection(callDocRef, "answerCandidates");

    await startWebcam();

    callInputRef.current.value = callDocRef.id;

    pc.current.onicecandidate = (event) => {
      if (event.candidate) {
        addDoc(offerCandidates, event.candidate.toJSON());
      }
    };

    const offerDescription = await pc.current.createOffer();
    await pc.current.setLocalDescription(offerDescription);

    await setDoc(callDocRef, {
      offer: {
        sdp: offerDescription.sdp,
        type: offerDescription.type,
      },
    });

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
    const callDocRef = doc(firestore, "calls", callId);
    const answerCandidates = collection(callDocRef, "answerCandidates");
    const offerCandidates = collection(callDocRef, "offerCandidates");

    await startWebcam();

    pc.current.onicecandidate = (event) => {
      if (event.candidate) {
        addDoc(answerCandidates, event.candidate.toJSON());
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
      answer: {
        type: answerDescription.type,
        sdp: answerDescription.sdp,
      },
    });

    onSnapshot(offerCandidates, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const candidate = new RTCIceCandidate(change.doc.data());
          pc.current.addIceCandidate(candidate);
        }
      });
    });
  };

  const copyText = () => {
    const copyText = document.getElementById("callID");
    copyText.select();
    copyText.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(copyText.value);
  };

  return (
    <>
      <header>
        <h1>OmeleTaz</h1>
        <h3>Just one call away.</h3>
      </header>
      <div className="videos">
        <video ref={webcamVideoRef} autoPlay playsInline></video>
        <video ref={remoteVideoRef} autoPlay playsInline></video>
      </div>
      <div className="buttonsWrapper">
        <div className="buttonsHorizontal">
          <h2>Create a new call</h2>
          <button onClick={createCall}>Start Call</button>
        </div>
        <div className="buttonsHorizontal">
          <h2>Join a Call</h2>
          <div className="answerCopyWrapper">
            <input
              id="callID"
              ref={callInputRef}
              placeholder="Input here the call ID of your friend..."
            />
            <div className="tooltip">
              <h3 className="tooltiptext" id="tooltipTextID">
                Copy Call ID
              </h3>
              <button id="copyBtn" onClick={copyText}>
                <img src={copyIcon} alt="Copy" />
              </button>
            </div>
            <button onClick={answerCall}>Join</button>
          </div>
        </div>
      </div>
    </>
  );
};

export default App;
