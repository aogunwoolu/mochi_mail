import { Switch, Route, Router as WouterRouter } from "wouter";
import { MochiProvider } from "./context/MochiContext";
import Home from "./pages/Home";
import RoomsPage from "./pages/RoomsPage";
import RoomInvitePage from "./pages/RoomInvitePage";
import SpacePage from "./pages/SpacePage";
import NotFound from "./pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/rooms" component={RoomsPage} />
      <Route path="/rooms/:inviteToken" component={RoomInvitePage} />
      <Route path="/space" component={SpacePage} />
      <Route path="/space/:username">
        {(params) => {
          window.location.replace(`/space?u=${encodeURIComponent(params.username ?? "")}`);
          return null;
        }}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <MochiProvider>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Router />
      </WouterRouter>
    </MochiProvider>
  );
}

export default App;
