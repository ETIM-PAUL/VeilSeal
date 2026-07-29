import React from "react";
import ReactDOM from "react-dom/client";
import {
  theme
 } from "./theme";
import {
  MantineProvider
} from "@mantine/core";

import "@mantine/core/styles.css";

import App from "./App";
import "@mantine/dates/styles.css";
import "./index.css";


ReactDOM.createRoot(
  document.getElementById("root")
)
.render(

<React.StrictMode>

<MantineProvider

theme={theme}

>

<App/>

</MantineProvider>

</React.StrictMode>

);