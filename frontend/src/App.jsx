import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { SocketProvider } from './contexts/SocketContext'
import Landing from './pages/Landing'
import PatientHome from './pages/patient/PatientHome'
import JoinQueue from './pages/patient/JoinQueue'
import QueueStatus from './pages/patient/QueueStatus'
import BookAppointment from './pages/patient/BookAppointment'
import FeedbackPage from './pages/patient/Feedback'
import PracticeLogin from './pages/practice/PracticeLogin'
import Dashboard from './pages/practice/Dashboard'

export default function App() {
  return (
    <SocketProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/patient/:practiceId" element={<PatientHome />} />
          <Route path="/patient/:practiceId/queue" element={<JoinQueue />} />
          <Route path="/patient/:practiceId/book" element={<BookAppointment />} />
          <Route path="/queue/status/:token" element={<QueueStatus />} />
          <Route path="/feedback/:practiceId" element={<FeedbackPage />} />
          <Route path="/practice" element={<PracticeLogin />} />
          <Route path="/practice/dashboard/:practiceId" element={<Dashboard />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </SocketProvider>
  )
}
