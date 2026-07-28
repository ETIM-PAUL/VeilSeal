import {
    createTheme
  } from "@mantine/core";
  
  
  export const theme = createTheme({
  
    primaryColor: "blue",
  
    fontFamily:
      "Inter, sans-serif",
  
  
    defaultRadius: "lg",
  
  
    colors: {
  
      brand: [
        "#EFF6FF",
        "#DBEAFE",
        "#BFDBFE",
        "#93C5FD",
        "#60A5FA",
        "#3B82F6",
        "#2563EB",
        "#1D4ED8",
        "#1E40AF",
        "#1E3A8A"
      ]
  
    },
  
  
    components:{
  
  
      Card:{
  
        defaultProps:{
          shadow:"sm",
          withBorder:true
        }
  
      },
  
  
      Button:{
  
        defaultProps:{
          radius:"md"
        }
  
      },
  
  
      TextInput:{
  
        defaultProps:{
          radius:"md"
        }
  
      }
  
    }
  
  });