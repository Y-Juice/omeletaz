import { collection, addDoc, getDocs, deleteDoc, doc } from "firebase/firestore";
// Add a user to the lobby
const joinLobby = async () => {
  const lobbyRef = collection(firestore, "lobby");
  
  // Check if there's someone in the lobby
  const lobbySnapshot = await getDocs(lobbyRef);
  let match = null;

  lobbySnapshot.forEach((doc) => {
    match = doc; // Get the first available user
  });

  if (match) {
    // If a match is found, connect to that user
    const matchDocRef = doc(firestore, "lobby", match.id);
    await deleteDoc(matchDocRef); // Remove the matched user from the lobby
    return match.id; // Return the matched user ID
  } else {
    // If no match is found, add the current user to the lobby
    const userDocRef = await addDoc(lobbyRef, { status: "waiting" });
    return userDocRef.id; // Return the current user's document ID
  }
};
