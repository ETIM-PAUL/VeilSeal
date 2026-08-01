import { BrowserRouter } from "react-router-dom";

import Routes from "./routes/Routes";

import AppLayout from "./layout/AppLayout";
import { WalletProvider } from "./context/WalletContext";
import { BidsProvider } from "./context/BidsContext";


export default function App(){

  return (
    <BrowserRouter>

      <WalletProvider>

        <BidsProvider>

          <AppLayout>

            <Routes />

          </AppLayout>

        </BidsProvider>

      </WalletProvider>

    </BrowserRouter>
  );
}