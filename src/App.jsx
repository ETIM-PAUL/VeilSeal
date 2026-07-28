import { BrowserRouter } from "react-router-dom";

import Routes from "./routes/Routes";

import AppLayout from "./layout/AppLayout";


export default function App(){

  return (
    <BrowserRouter>

      <AppLayout>

        <Routes />

      </AppLayout>

    </BrowserRouter>
  );
}