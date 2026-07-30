import GeoConstanzaApp from './GeoConstanzaApp';
import Reportes from "./pages/Reportes";
import { BrowserRouter, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/reportes/crear" element={<Reportes />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;