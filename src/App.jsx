import { BrowserRouter } from "react-router-dom";

import Routes from "./routes/Routes";

import AppLayout from "./layout/AppLayout";
import { WalletProvider } from "./context/WalletContext";


export default function App(){

  return (
    <BrowserRouter>

      <WalletProvider>

        <AppLayout>

          <Routes />

        </AppLayout>

      </WalletProvider>

    </BrowserRouter>
  );
}