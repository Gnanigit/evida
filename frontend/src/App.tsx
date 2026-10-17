import { Navigate, Route, Routes, useParams } from 'react-router'
import AuthProvider from './auth/AuthProvider'
import { RedirectIfSignedIn, RequireAuth } from './auth/RouteGuards'
import AppLayout from './components/layout/AppLayout'
import ChatPage from './pages/ChatPage'
import DocumentsPage from './pages/DocumentsPage'
import SignInPage from './pages/SignInPage'
import SignUpPage from './pages/SignUpPage'

// A fresh ChatPage per conversation, so no messages leak between conversations.
function ChatRoute() {
  const { conversationId } = useParams()
  return <ChatPage key={conversationId ?? 'new'} conversationId={conversationId} />
}

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<RedirectIfSignedIn />}>
          <Route path="/signin" element={<SignInPage />} />
          <Route path="/signup" element={<SignUpPage />} />
        </Route>
        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route index element={<ChatRoute />} />
            <Route path="c/:conversationId" element={<ChatRoute />} />
            <Route path="documents" element={<DocumentsPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}

export default App
