
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import { ClientIntakeRequestPage } from "./app/pages/ClientIntakeRequestPage";
  import { INTAKE_REQUEST_PATH } from "./app/intake/intakeRequestStore";
  import "./styles/index.css";

  // A client's request link, /intake-request/{token}, opens the client-side
  // document upload page on its own — never the attorney dashboard.
  const intakeMatch = window.location.pathname.match(INTAKE_REQUEST_PATH);

  createRoot(document.getElementById("root")!).render(
    intakeMatch ? <ClientIntakeRequestPage token={intakeMatch[1]} /> : <App />,
  );
