import { BrowserRouter } from "react-router-dom";

import Routes from "./routes/Routes";

import AppLayout from "./layout/AppLayout";
import { WalletProvider } from "./context/WalletContext";
import { BidsProvider } from "./context/BidsContext";
import { CipherListingsProvider } from "./context/CipherListingsContext";


export default function App(){

  return (
    <BrowserRouter>

      <WalletProvider>

        <BidsProvider>

          <CipherListingsProvider>

            <AppLayout>

              <Routes />

            </AppLayout>

          </CipherListingsProvider>

        </BidsProvider>

      </WalletProvider>

    </BrowserRouter>
  );
}