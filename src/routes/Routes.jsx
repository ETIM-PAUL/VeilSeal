import {
    Routes,
    Route
   } from "react-router-dom";
   
   
   import Dashboard from "../pages/Dashboard";
   import Transfers from "../pages/Transfers";
   import Bids from "../pages/Bids";
   import StealthListings from "../pages/StealthListings";
   import Agents from "../pages/Agents";
   import Operations from "../pages/Operations";
   
   
   export default function AppRoutes(){
   
   return (
   
   <Routes>
   
   <Route path="/" element={<Dashboard/>}/>

   <Route path="/p2p-transfers" element={<Transfers/>}/>
   
   <Route path="/listings" element={<Bids/>}/>

   <Route path="/stealth-listings" element={<StealthListings/>}/>

   <Route path="/agents" element={<Agents/>}/>

   <Route path="/operations" element={<Operations/>}/>
   
   
   
   </Routes>
   
   )
   
   }