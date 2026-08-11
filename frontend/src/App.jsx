import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AdminLayout from "./components/AdminLayout";
import AdminRoute from "./components/AdminRoute";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import ProfileRequiredRoute from "./components/ProfileRequiredRoute";
import AdminPsychologistDetail from "./pages/AdminPsychologistDetail";
import AdminPsychologists from "./pages/AdminPsychologists";
import Dashboard from "./pages/Dashboard";
import Appointments from "./pages/Appointments";
import Patients from "./pages/Patients";
import PatientHistory from "./pages/PatientHistory";
import Availability from "./pages/Availability";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import Home from "./pages/Home";
import PublicBooking from "./pages/PublicBooking";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/reservar/:slug" element={<PublicBooking />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminPsychologists />} />
              <Route path="psychologists/:psychologistId" element={<AdminPsychologistDetail />} />
            </Route>
          </Route>

          <Route element={<Layout />}>
            <Route path="/profile" element={<Profile />} />

            <Route element={<ProfileRequiredRoute />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/appointments" element={<Appointments />} />
              <Route path="/patients" element={<Patients />} />
              <Route path="/patients/:patientId/history" element={<PatientHistory />} />
              <Route path="/availability" element={<Availability />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
