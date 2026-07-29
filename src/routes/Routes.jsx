import {
    Routes,
    Route
   } from "react-router-dom";
   
   
   import Dashboard from "../pages/Dashboard";
   import Treasury from "../pages/Treasuries";
   import TreasuryDetails from "../pages/TreasuryDetails";
   import Transfers from "../pages/Transfers";
   import Bids from "../pages/Bids";
   import Activity from "../pages/Activity";
   
   
   export default function AppRoutes(){
   
   return (
   
   <Routes>
   
   <Route path="/" element={<Dashboard/>}/>
   
   <Route path="/treasuries" element={<Treasury/>}/>
   <Route path="/treasuries/:id" element={<TreasuryDetails/>}/>
   
   <Route path="/p2p-transfers" element={<Transfers/>}/>
   
   <Route path="/bids" element={<Bids/>}/>
   
   <Route path="/operations" element={<Activity/>}/>
   
   
   
   </Routes>
   
   )
   
   }