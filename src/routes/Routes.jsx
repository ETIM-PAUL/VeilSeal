import {
    Routes,
    Route
   } from "react-router-dom";
   
   
   import Dashboard from "../pages/Dashboard";
   import Bids from "../pages/Bids";
   import StealthListings from "../pages/StealthListings";
   import CipherListings from "../pages/CipherListings";
   import Agents from "../pages/Agents";
   import Operations from "../pages/Operations";
   
   
   export default function AppRoutes(){
   
   return (
   
   <Routes>
   
   <Route path="/" element={<Dashboard/>}/>

   <Route path="/listings" element={<Bids/>}/>

   <Route path="/stealth-listings" element={<StealthListings/>}/>

   <Route path="/cipher-listings" element={<CipherListings/>}/>

   <Route path="/agents" element={<Agents/>}/>

   <Route path="/operations" element={<Operations/>}/>
   
   
   
   </Routes>
   
   )
   
   }