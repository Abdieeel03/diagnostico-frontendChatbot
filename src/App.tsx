import { ChatBotMedico } from "./components/ChatBotMedico";
import "./App.css";

const App = () => {
  return (
    <div className="demo-page">
      {/* Tu contenido de página iría aquí */}
      <ChatBotMedico
        apiUrl="/api/chat"
        defaultMode="demo"
      />
    </div>
  );
};

export default App;