# Poutre

This project is a small web application for the sizing of a reinforced concrete beam. It uses the p5.js library to draw interactive diagrams and to display results directly in the browser.

## Running the web app

Open `index.html` in a modern browser to start using the application. You can simply double-click the file or serve the folder with a lightweight HTTP server:

```sh
python3 -m http.server
```

Navigate to `http://localhost:8000` in your browser and the interface will appear.

## Calculations

After entering the beam type, span, uniform load and material properties, the script computes:

- Shear and bending moment diagrams for the selected configuration.
- The design bending moment and the required steel area using the design strengths (f_{cd} and f_{yd}).
- A comparison between required and provided reinforcement to validate bending capacity.

All calculations are performed client-side in JavaScript and the results are presented with interactive graphics.
