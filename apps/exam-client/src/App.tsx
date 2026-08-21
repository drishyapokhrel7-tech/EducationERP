import { useState } from "react";
import type { SafeUser } from "@education-erp/api-client";
import { LoginScreen } from "./screens/LoginScreen";
import { ExamListScreen } from "./screens/ExamListScreen";
import { ExamTakingScreen } from "./screens/ExamTakingScreen";

type Screen =
  | { name: "login" }
  | { name: "list"; user: SafeUser }
  | { name: "taking"; user: SafeUser; examSubjectId: string }
  | { name: "submitted"; user: SafeUser };

export function App() {
  const [screen, setScreen] = useState<Screen>({ name: "login" });

  async function handleLogout() {
    await window.examClient.logout();
    setScreen({ name: "login" });
  }

  switch (screen.name) {
    case "login":
      return <LoginScreen onLoggedIn={(user) => setScreen({ name: "list", user })} />;
    case "list":
      return (
        <ExamListScreen
          user={screen.user}
          onStartExam={(examSubjectId) => setScreen({ name: "taking", user: screen.user, examSubjectId })}
          onLogout={handleLogout}
        />
      );
    case "taking":
      return (
        <ExamTakingScreen
          examSubjectId={screen.examSubjectId}
          onSubmitted={() => setScreen({ name: "submitted", user: screen.user })}
        />
      );
    case "submitted":
      return (
        <div className="screen centered">
          <h1>Exam submitted</h1>
          <p>You can close this station now, or log out for the next student.</p>
          <button type="button" onClick={handleLogout}>
            Log out
          </button>
        </div>
      );
  }
}
