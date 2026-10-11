import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCUB3IgvC8SLTe0LLNNrMpm1fpUnHzA60M",
  authDomain: "codeforge-mca.firebaseapp.com",
  projectId: "codeforge-mca",
  storageBucket: "codeforge-mca.firebasestorage.app",
  messagingSenderId: "735892442838",
  appId: "1:735892442838:web:29a48f5844690d5ba10377",
  measurementId: "G-19GBHCB2H1"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
