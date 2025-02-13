import { Suspense } from "react";
import Login from "./components/auth/login";
import Signup from "./components/auth/signup";
import Profile from "./components/auth/profile";
import { useRoutes, Routes, Route, Navigate } from "react-router-dom";
import Lobby from "./components/chat/lobby";
import ChatView from "./components/chat/chat-view";
import InvitePage from "./components/chat/invite-page";
import routes from "tempo-routes";
import { AuthProvider } from "./lib/auth";
import { useAuth } from "./lib/auth";

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" />;

  return <>{children}</>;
}

function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<p>Loading...</p>}>
        <>
          <Routes>
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <Lobby />
                </PrivateRoute>
              }
            />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/invite/:chatId" element={<InvitePage />} />
            <Route
              path="/profile"
              element={
                <PrivateRoute>
                  <Profile />
                </PrivateRoute>
              }
            />
            <Route
              path="/profile/:userId"
              element={
                <PrivateRoute>
                  <Profile />
                </PrivateRoute>
              }
            />
            <Route
              path="/chat/:id"
              element={
                <PrivateRoute>
                  <ChatView />
                </PrivateRoute>
              }
            />
          </Routes>
          {import.meta.env.VITE_TEMPO === "true" && useRoutes(routes)}
          {import.meta.env.VITE_TEMPO === "true" && (
            <Routes>
              <Route path="/tempobook/*" />
            </Routes>
          )}
        </>
      </Suspense>
    </AuthProvider>
  );
}

export default App;
