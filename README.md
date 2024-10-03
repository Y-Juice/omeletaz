# OmeleTaz

OmeleTaz is a real-time video chat application built using React, Firebase Firestore, and WebRTC. This application allows users to Chat and meet other users.

## Features

- Start a webcam video stream
- Create a new video call
- Join an existing video call
- Real-time communication using Firestore
- Peer-to-peer connection using WebRTC

## Technologies Used

- **React**: A JavaScript library for building user interfaces.
- **Firebase**: For backend services, including Firestore for real-time data storage.
- **WebRTC**: For peer-to-peer audio and video communication.

## Prerequisites

Before you begin, ensure you have the following installed:

- Node.js (v14 or higher)
- npm (comes with Node.js)

## Getting Started

1. **Clone the Repository**

   ```bash
   git clone https://github.com/your-username/omeletaz.git
   cd omeletaz
   ```

2. **Install Dependencies**

   Run the following command to install the necessary dependencies:

   ```bash
   npm install
   ```


4. **Run the Application**

   Start the application with:

   ```bash
   npm start
   ```

   Your application should now be running on [http://localhost:3000](http://localhost:3000).

## Usage

- Click the **"Start Webcam"** button to initiate your webcam stream.
- Use the **"Call"** button to create a new call and copy the call ID.
- Paste the call ID in the input field to join an existing call, and click the **"Answer"** button.


## Acknowledgments

- [React](https://reactjs.org/) - The library used for building the UI.
- [Firebase](https://firebase.google.com/) - For backend services.
- [WebRTC](https://webrtc.org/) - For real-time communication.