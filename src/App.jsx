import { useState, useEffect } from 'react';
import './App.css';

// <--- NEW: Defininng Backend API URL here
const API_BASE_URL = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:5000';
// Note: 'import.meta.env.VITE_BACKEND_API_URL' is for Vite. For Create React App, it's process.env.REACT_APP_BACKEND_API_URL
console.log("API_BASE_URL:", API_BASE_URL); // Debugging line to check the URL
function App() {
  const [url, setUrl] = useState('');
  const [method, setMethod] = useState('GET');
  const [headers, setHeaders] = useState('');
  const [body, setBody] = useState('');
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);

  // --- NEW: Authentication States ---
  const [isRegistering, setIsRegistering] = useState(false); // Toggle between register/login form
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authMessage, setAuthMessage] = useState(null); // For login/register messages
  const [token, setToken] = useState(localStorage.getItem('token')); // Load token from local storage
  const [loggedInUser, setLoggedInUser] = useState(localStorage.getItem('username')); // Load username


  // Function to fetch history (modified to use token)
  const fetchHistory = async () => {
    if (!token) return; // Only fetch if authenticated

    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await fetch($`{API_BASE_URL}/api/history`, { 
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` // <--- NEW: Send token with 'Bearer' prefix
        }
      });
      if (!res.ok) {
        // If history fetching fails due to auth (e.g., token expired), clear token
        if (res.status === 401 || res.status === 403) {
            setToken(null);
            setLoggedInUser(null);
            localStorage.removeItem('token');
            localStorage.removeItem('username');
            setHistory([]); // Clear history on unauthorized
            setHistoryError("Session expired or unauthorized. Please log in again.");
            return;
        }
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data = await res.json();
      setHistory(data);
    } catch (err) {
      console.error("Failed to fetch history:", err);
      setHistoryError(err.message || "Could not load history.");
    } finally {
      setHistoryLoading(false);
    }
  };

  // Call fetchHistory when the component mounts or token changes
  useEffect(() => {
    if (token) {
        fetchHistory();
    } else {
        setHistory([]); // Clear history if no token
    }
  }, [token]); // Rerun when token changes

  // Function to handle sending the request (modified to use token)
  const sendRequest = async () => {
    setLoading(true);
    setError(null);
    setResponse(null); // Clear previous response

    if (!token) { // <--- NEW: Require authentication
      setError("Please log in to send requests.");
      setLoading(false);
      return;
    }

    try {
      let parsedHeaders = {};
      if (headers) {
        try {
          parsedHeaders = JSON.parse(headers);
        } catch (e) {
          setError("Error parsing Headers JSON. Please ensure it's valid JSON.");
          setLoading(false);
          return;
        }
      }

      let parsedBody = {};
      if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        try {
          parsedBody = JSON.parse(body);
        } catch (e) {
          setError("Error parsing Body JSON. Please ensure it's valid JSON for POST/PUT/PATCH.");
          setLoading(false);
          return;
        }
      }

      // Sending to your Backend Proxy
      const backendResponse = await fetch(`${API_BASE_URL}/api/proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`, // <--- NEW: Send token with 'Bearer' prefix
        },
        body: JSON.stringify({
          url: url,
          method: method,
          headers: parsedHeaders,
          body: parsedBody,
        }),
      });

      if (!backendResponse.ok) {
         // If proxy fails due to auth (e.g., token expired), clear token
        if (backendResponse.status === 401 || backendResponse.status === 403) {
            setToken(null);
            setLoggedInUser(null);
            localStorage.removeItem('token');
            localStorage.removeItem('username');
            setHistory([]);
            setError("Session expired or unauthorized. Please log in again.");
            return;
        }
        const errorData = await backendResponse.json();
        throw new Error(errorData.error || `HTTP error! status: ${backendResponse.status}`);
      }

      const data = await backendResponse.json();
      setResponse(data);
      fetchHistory(); // Refresh history after a successful request

    } catch (err) {
      console.error("Failed to send request:", err);
      setError(err.message || "An unknown error occurred.");
    } finally {
      setLoading(false);
    }
  };

  // --- NEW: Authentication Handlers ---
 const handleAuth = async (e) => {
    e.preventDefault();
    setAuthMessage(null);
    setLoading(true);

    const endpoint = isRegistering ? 'register' : 'login';
    try {
        // CORRECTED LINE: Remove the extra 'await fetch(' from inside the backticks
        const res = await fetch(`${API_BASE_URL}/api/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: authUsername, password: authPassword }),
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.message || 'Authentication failed');
        }

        setAuthMessage(data.message);
        setToken(data.token);
        setLoggedInUser(authUsername);
        localStorage.setItem('token', data.token); // Store token
        localStorage.setItem('username', authUsername); // Store username
        setAuthUsername('');
        setAuthPassword('');
        fetchHistory(); // Fetch history for the logged-in user

    } catch (err) {
        setAuthMessage(err.message || 'An error occurred during authentication');
    } finally {
        setLoading(false);
    }
};

  const handleLogout = () => {
    setToken(null);
    setLoggedInUser(null);
    localStorage.removeItem('token'); // Remove token from local storage
    localStorage.removeItem('username'); // Remove username from local storage
    setAuthMessage("Logged out successfully.");
    setHistory([]); // Clear history on logout
  };

  return (
    <div className="App" style={{ fontFamily: 'Arial, sans-serif', maxWidth: '1200px', margin: '20px auto', padding: '20px', border: '1px solid #ccc', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h1>My Postman Clone</h1>

      {/* Authentication Section - NEW */}
      <div className="auth-section" style={{ border: '1px solid #eee', padding: '150px', borderRadius: '5px', marginBottom: '200px', backgroundColor: '#ffffff' }}>
        {token ? ( // If token exists, user is logged in
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p>Logged in as: <strong>{loggedInUser}</strong></p>
            <button onClick={handleLogout} style={{ padding: '8px 15px', backgroundColor: 'black', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              Logout
            </button>
          </div>
        ) : ( // Otherwise, show login/register form
          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h2>{isRegistering ? 'Register' : 'Login'}</h2>
            {authMessage && <p style={{ color: authMessage.includes('successfully') ? 'green' : 'red', fontWeight: 'bold' }}>{authMessage}</p>}
            <input
              type="text"
              placeholder="Username"
              value={authUsername}
              onChange={(e) => setAuthUsername(e.target.value)}
              required
              style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
            <input
              type="password"
              placeholder="Password"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              required
              style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
            <button type="submit" disabled={loading} style={{ padding: '10px 15px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: loading ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Processing...' : (isRegistering ? 'Register' : 'Login')}
            </button>
            <button
              type="button"
              onClick={() => setIsRegistering(!isRegistering)}
              style={{ padding: '8px 15px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '5px' }}
            >
              {isRegistering ? 'Already have an account? Login' : 'Need an account? Register'}
            </button>
          </form>
        )}
      </div>

      {/* Rest of your existing Request and History Sections - NOW CONDITIONAL */}
      {token && ( // <--- NEW: Only show main app if authenticated
        <div style={{ display: 'flex', gap: '20px' }}>
          {/* Request Section */}
          <div className="request-section" style={{ flex: 2, marginBottom: '30px', padding: '15px', border: '1px solid #eee', borderRadius: '5px' }}>
            <h2>Request</h2>
            <input
              type="text"
              placeholder="Enter URL (e.g., https://jsonplaceholder.typicode.com/todos/1)"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              style={{ width: 'calc(100% - 20px)', padding: '10px', marginBottom: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
            <br />
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              style={{ padding: '10px', marginBottom: '10px', border: '1px solid #ddd', borderRadius: '4px', marginRight: '10px' }}
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
              <option value="PATCH">PATCH</option>
            </select>
            <button
              onClick={sendRequest}
              disabled={loading}
              style={{ padding: '10px 20px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: loading ? 'not-allowed' : 'pointer' }}
            >
              {loading ? 'Sending...' : 'Send Request'}
            </button>

            <h3 style={{ marginTop: '20px' }}>Headers (JSON)</h3>
            <textarea
              placeholder="Enter headers as JSON (e.g., {'Content-Type': 'application/json'})"
              rows="3"
              value={headers}
              onChange={(e) => setHeaders(e.target.value)}
              style={{ width: 'calc(100% - 20px)', padding: '10px', marginBottom: '10px', border: '1px solid #ddd', borderRadius: '4px' }}
            ></textarea>

            <h3 style={{ marginTop: '20px' }}>Request Body (JSON)</h3>
            <textarea
              placeholder="Enter request body as JSON for POST/PUT/PATCH"
              rows="5"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              style={{ width: 'calc(100% - 20px)', padding: '10px', marginBottom: '20px', border: '1px solid #ddd', borderRadius: '4px' }}
            ></textarea>

            <hr style={{ borderTop: '1px dashed #ccc', margin: '30px 0' }} />

            <div className="response-section" style={{ padding: '15px', border: '1px solid #eee', borderRadius: '5px' }}>
              <h2>Response</h2>
              {error && <p style={{ color: 'red', fontWeight: 'bold' }}>Error: {error}</p>}
              {response ? (
                <div>
                  <p>Status: **{response.status}**</p>
                  <h3>Headers:</h3>
                  <pre style={{ backgroundColor: 'black', padding: '10px', borderRadius: '4px', maxHeight: '150px', overflowY: 'auto' }}>
                    {JSON.stringify(response.headers, null, 2)}
                  </pre>
                  <h3>Body:</h3>
                  <pre style={{ backgroundColor: 'black', padding: '10px', borderRadius: '4px', maxHeight: '300px', overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {JSON.stringify(response.data, null, 2)}
                  </pre>
                </div>
              ) : (
                <p>No response yet. Fill in the URL and click "Send Request".</p>
              )}
            </div>
          </div>

          {/* History Section */}
          <div className="history-section" style={{ flex: 1, padding: '15px', border: '1px solid #eee', borderRadius: '5px', maxHeight: '800px', overflowY: 'auto' }}>
            <h2>Request History</h2>
            <button onClick={fetchHistory} disabled={historyLoading} style={{ padding: '8px 15px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: historyLoading ? 'not-allowed' : 'pointer', marginBottom: '15px' }}>
              {historyLoading ? 'Loading...' : 'Refresh History'}
            </button>
            {historyError && <p style={{ color: 'red' }}>Error: {historyError}</p>}
            {history.length === 0 && !historyLoading && !historyError && <p>No requests in history yet.</p>}
            <div className="history-list">
              {history.map((item) => (
                <div key={item._id} style={{ border: '1px solid #ddd', padding: '10px', marginBottom: '10px', borderRadius: '4px', cursor: 'pointer' }}
                     onClick={() => {
                       setUrl(item.url);
                       setMethod(item.method);
                       setHeaders(JSON.stringify(item.headers, null, 2));
                       setBody(JSON.stringify(item.body, null, 2));
                       setResponse({status: item.responseStatus, headers: item.responseHeaders, data: item.responseData});
                     }}>
                  <p><strong>{item.method}</strong> <span style={{ color: '#007bff' }}>{item.url}</span></p>
                  <p style={{ fontSize: '0.8em', color: '#555' }}>Status: {item.responseStatus}</p>
                  <p style={{ fontSize: '0.7em', color: '#888' }}>{new Date(item.timestamp).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
