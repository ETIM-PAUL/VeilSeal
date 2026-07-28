import {
    Routes,
    Route
   } from "react-router-dom";
   
   
   import Dashboard from "../pages/Dashboard";
   import Treasury from "../pages/Treasury";
   import Transfers from "../pages/Transfers";
   import Bids from "../pages/Bids";
   import Activity from "../pages/Activity";
   
   
   export default function AppRoutes(){
   
   return (
   
   <Routes>
   
   <Route path="/" element={<Dashboard/>}/>
   
   <Route path="/treasuries" element={<Treasury/>}/>
   
   <Route path="/transfers" element={<Transfers/>}/>
   
   <Route path="/bids" element={<Bids/>}/>
   
   <Route path="/operations" element={<Activity/>}/>
   
   
   
   </Routes>
   
   )
   
   }