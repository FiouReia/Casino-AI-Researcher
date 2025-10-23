import { useState, useEffect } from 'react';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [summary, setSummary] = useState(null);
  const [researches, setResearches] = useState([]);
  const [currentResearch, setCurrentResearch] = useState(null);
  const [casinos, setCasinos] = useState([]);
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedState, setSelectedState] = useState('NJ');
  const [researchProgress, setResearchProgress] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState({});

  // Fetch dashboard summary
  const fetchSummary = async () => {
    try {
      const res = await fetch(`${API_URL}/api/dashboard/summary`);
      const data = await res.json();
      setSummary(data);
    } catch (error) {
      console.error('Error fetching summary:', error);
    }
  };

  // Fetch research history
  const fetchResearches = async () => {
    try {
      const res = await fetch(`${API_URL}/api/research/runs`);
      const data = await res.json();
      setResearches(data);
      if (data.length > 0) {
        setCurrentResearch(data[0]);
      }
    } catch (error) {
      console.error('Error fetching researches:', error);
    }
  };

  // Fetch casinos
  const fetchCasinos = async () => {
    try {
      const url = selectedState 
        ? `${API_URL}/api/casinos?state=${selectedState}`
        : `${API_URL}/api/casinos`;
      const res = await fetch(url);
      const data = await res.json();
      setCasinos(data);
    } catch (error) {
      console.error('Error fetching casinos:', error);
    }
  };

  // Fetch offers
  const fetchOffers = async () => {
    try {
      const url = selectedState
        ? `${API_URL}/api/offers?state=${selectedState}`
        : `${API_URL}/api/offers`;
      const res = await fetch(url);
      const data = await res.json();
      setOffers(data);
    } catch (error) {
      console.error('Error fetching offers:', error);
    }
  };

  // Initialize - fetch existing offers
  const handleInitialize = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/research/init`, { method: 'POST' });
      const data = await res.json();
      alert(`Initialized! Imported ${data.offersImported} offers from ${data.casinos} casinos`);
      fetchSummary();
      fetchCasinos();
      fetchOffers();
    } catch (error) {
      console.error('Error initializing:', error);
      alert('Error initializing');
    } finally {
      setLoading(false);
    }
  };

  // Run research
  const handleRunResearch = async () => {
    setLoading(true);
    setResearchProgress({ status: 'starting', logs: [] });
    
    try {
      const res = await fetch(`${API_URL}/api/research/run`, { method: 'POST' });
      const data = await res.json();
      alert(`Research started! Run ID: ${data.runId}`);
      
      // Poll for completion and progress
      let completed = false;
      let attempts = 0;
      while (!completed && attempts < 200) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        const runRes = await fetch(`${API_URL}/api/research/runs/${data.runId}`);
        const runData = await runRes.json();
        
        // Update progress
        setResearchProgress({
          status: runData.status,
          currentState: runData.currentState,
          currentCasino: runData.currentCasino,
          casinosProcessed: runData.casinosProcessed,
          offersProcessed: runData.offersProcessed,
          logs: runData.progressLog || []
        });
        
        if (runData.status === 'completed' || runData.status === 'failed') {
          completed = true;
          setCurrentResearch(runData);
          fetchSummary();
          fetchCasinos();
          fetchOffers();
          fetchResearches();
          alert(`Research ${runData.status}!`);
          setResearchProgress(null);
        }
        attempts++;
      }
    } catch (error) {
      console.error('Error running research:', error);
      alert('Error running research');
      setResearchProgress(null);
    } finally {
      setLoading(false);
    }
  };

  // Delete offer
  const handleDeleteOffer = async (casinoName, offerName) => {
    if (!confirm(`Delete offer: ${offerName}?`)) return;
    
    try {
      const allOffers = await fetch(`${API_URL}/api/offers`).then(r => r.json());
      const targetOffer = allOffers.find(o => o.casinoName === casinoName && o.offerName === offerName);
      
      if (targetOffer) {
        await fetch(`${API_URL}/api/offers/${targetOffer._id}`, { method: 'DELETE' });
        alert('Offer deleted successfully');
        fetchResearches();
        fetchOffers();
      }
    } catch (error) {
      console.error('Error deleting offer:', error);
      alert('Error deleting offer');
    }
  };

  // Analyze offers with AI
  const handleAnalyzeOffers = async (casinoName, currentOffers, newOffers) => {
    setAnalyzing(true);
    try {
      const res = await fetch(`${API_URL}/api/offers/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ casinoName, currentOffers, newOffers })
      });
      const data = await res.json();
      
      setAnalysisResults(prev => ({
        ...prev,
        [casinoName]: data.analysis
      }));
      
      alert('Analysis complete! Check the recommendations below each offer.');
    } catch (error) {
      console.error('Error analyzing offers:', error);
      alert('Error analyzing offers');
    } finally {
      setAnalyzing(false);
    }
  };

  useEffect(() => {
    fetchSummary();
    fetchResearches();
  }, []);

  useEffect(() => {
    if (activeTab === 'casinos') {
      fetchCasinos();
    } else if (activeTab === 'offers') {
      fetchOffers();
    }
  }, [activeTab, selectedState]);

  return (
    <div className="app">
      <header className="header">
        <h1>🎰 Casino & Offer AI Researcher</h1>
        <p>Intelligent casino discovery and promotional offer analysis</p>
      </header>

      <nav className="tabs">
        <button 
          className={`tab ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          Dashboard
        </button>
        <button 
          className={`tab ${activeTab === 'missing' ? 'active' : ''}`}
          onClick={() => setActiveTab('missing')}
        >
          Missing Casinos
        </button>
        <button 
          className={`tab ${activeTab === 'comparisons' ? 'active' : ''}`}
          onClick={() => setActiveTab('comparisons')}
        >
          Offer Comparisons
        </button>
        <button 
          className={`tab ${activeTab === 'casinos' ? 'active' : ''}`}
          onClick={() => setActiveTab('casinos')}
        >
          All Casinos
        </button>
        <button 
          className={`tab ${activeTab === 'offers' ? 'active' : ''}`}
          onClick={() => setActiveTab('offers')}
        >
          All Offers
        </button>
        <button 
          className={`tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          History
        </button>
      </nav>

      <div className="container">
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="tab-content">
            <div className="controls">
              <button 
                className="btn btn-primary"
                onClick={handleInitialize}
                disabled={loading}
              >
                {loading ? 'Processing...' : '📥 Initialize (Fetch Existing Offers)'}
              </button>
              <button 
                className="btn btn-success"
                onClick={handleRunResearch}
                disabled={loading}
              >
                {loading ? 'Processing...' : '🔍 Run Full Research'}
              </button>
            </div>

            {summary && (
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-value">{summary.totalCasinos}</div>
                  <div className="stat-label">Total Casinos</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{summary.discoveredCasinos}</div>
                  <div className="stat-label">AI Discovered</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{summary.totalOffers}</div>
                  <div className="stat-label">Total Offers</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{summary.aiResearchOffers}</div>
                  <div className="stat-label">AI Research Offers</div>
                </div>
              </div>
            )}

            {summary?.latestRun && (
              <div className="latest-run">
                <h3>Latest Research Run</h3>
                <p><strong>Status:</strong> <span className={`status ${summary.latestRun.status}`}>{summary.latestRun.status}</span></p>
                <p><strong>Started:</strong> {new Date(summary.latestRun.startedAt).toLocaleString()}</p>
                {summary.latestRun.completedAt && (
                  <p><strong>Completed:</strong> {new Date(summary.latestRun.completedAt).toLocaleString()}</p>
                )}
                {summary.latestRun.summary && (
                  <div>
                    <p><strong>Missing Casinos:</strong> {summary.latestRun.summary.totalMissingCasinos}</p>
                    <p><strong>New Offers Found:</strong> {summary.latestRun.summary.totalNewOffers}</p>
                  </div>
                )}
              </div>
            )}

            {researchProgress && (
              <div className="research-progress">
                <h3>🔄 Research in Progress</h3>
                {researchProgress.currentState && (
                  <p><strong>Current State:</strong> {researchProgress.currentState}</p>
                )}
                {researchProgress.currentCasino && (
                  <p><strong>Processing Casino:</strong> {researchProgress.currentCasino}</p>
                )}
                {researchProgress.casinosProcessed > 0 && (
                  <p><strong>Casinos Processed:</strong> {researchProgress.casinosProcessed}</p>
                )}
                {researchProgress.offersProcessed > 0 && (
                  <p><strong>New Offers Found:</strong> {researchProgress.offersProcessed}</p>
                )}
                
                {researchProgress.logs && researchProgress.logs.length > 0 && (
                  <div className="progress-log">
                    <h4>Progress Log:</h4>
                    <div className="log-container">
                      {researchProgress.logs.slice(-10).map((log, idx) => (
                        <div key={idx} className="log-entry">{log}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Missing Casinos Tab */}
        {activeTab === 'missing' && currentResearch && (
          <div className="tab-content">
            <h2>Missing Casinos by State</h2>
            {currentResearch.missingCasinos && currentResearch.missingCasinos.length > 0 ? (
              currentResearch.missingCasinos.map((state) => (
                <div key={state.state} className="state-section">
                  <h3>{state.state} ({state.casinos.length} missing)</h3>
                  <ul className="casino-list">
                    {state.casinos.map((casino, idx) => (
                      <li key={idx}>{casino}</li>
                    ))}
                  </ul>
                </div>
              ))
            ) : (
              <p>No missing casinos detected. Run research to check for gaps.</p>
            )}
          </div>
        )}

        {/* Offer Comparisons Tab */}
        {activeTab === 'comparisons' && currentResearch && (
          <div className="tab-content">
            <h2>Offer Comparisons</h2>
            {currentResearch.offerComparisons && currentResearch.offerComparisons.length > 0 ? (
              currentResearch.offerComparisons.map((comparison, idx) => (
                <div key={idx} className="comparison-card">
                  <h3>{comparison.casinoName} ({comparison.state})</h3>
                  
                  <button 
                    className="btn btn-analyze"
                    onClick={() => handleAnalyzeOffers(
                      comparison.casinoName, 
                      comparison.currentOffers, 
                      comparison.newOffers
                    )}
                    disabled={analyzing}
                  >
                    {analyzing ? '🤔 Analyzing...' : '🧠 AI Analyze New Offers'}
                  </button>

                  <div className="comparison-grid">
                    <div className="comparison-section">
                      <h4>Current Offers ({comparison.currentOffers.length})</h4>
                      <ul>
                        {comparison.currentOffers.map((o, i) => (
                          <li key={i}>
                            <strong>{o.name}</strong><br/>
                            Type: {o.type} | Deposit: ${o.deposit} | Bonus: ${o.bonus}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="comparison-section">
                      <h4>Discovered Offers ({comparison.discoveredOffers.length})</h4>
                      <ul>
                        {comparison.discoveredOffers.map((o, i) => (
                          <li key={i}>
                            <strong>{o.name}</strong><br/>
                            Type: {o.type} | Deposit: ${o.deposit} | Bonus: ${o.bonus}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="comparison-section new">
                      <h4>✨ New Offers ({comparison.newOffers.length})</h4>
                      <ul>
                        {comparison.newOffers.map((o, i) => {
                          const analysis = analysisResults[comparison.casinoName]?.find(
                            a => a.offerName === o.name
                          );
                          
                          return (
                            <li key={i}>
                              <strong>{o.name}</strong><br/>
                              Type: {o.type} | Deposit: ${o.deposit} | Bonus: ${o.bonus}
                              
                              {analysis && (
                                <div className={`analysis ${analysis.isSuperior ? 'superior' : 'not-superior'}`}>
                                  <strong>{analysis.isSuperior ? '✅ Superior' : '❌ Not Superior'}</strong>
                                  <p>{analysis.reasoning}</p>
                                  <span className="recommendation">
                                    Recommendation: <strong>{analysis.recommendation.toUpperCase()}</strong>
                                  </span>
                                </div>
                              )}
                              
                              <button 
                                className="btn btn-delete-small"
                                onClick={() => handleDeleteOffer(comparison.casinoName, o.name)}
                              >
                                🗑️ Delete
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p>No new offers found. Run research to discover opportunities.</p>
            )}
          </div>
        )}

        {/* All Casinos Tab */}
        {activeTab === 'casinos' && (
          <div className="tab-content">
            <h2>All Casinos</h2>
            <div className="filter">
              <label>Filter by State:</label>
              <select value={selectedState} onChange={(e) => setSelectedState(e.target.value)}>
                <option value="">All States</option>
                <option value="NJ">New Jersey</option>
                <option value="MI">Michigan</option>
                <option value="PA">Pennsylvania</option>
                <option value="WV">West Virginia</option>
              </select>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>Casino Name</th>
                  <th>State</th>
                  <th>Website</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {casinos.map((casino) => (
                  <tr key={casino._id}>
                    <td>{casino.name}</td>
                    <td>{casino.state}</td>
                    <td>{casino.website ? <a href={casino.website} target="_blank" rel="noreferrer">Visit</a> : 'N/A'}</td>
                    <td><span className={`badge ${casino.discovered ? 'ai' : 'internal'}`}>
                      {casino.discovered ? 'AI Discovered' : 'Internal'}
                    </span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* All Offers Tab */}
        {activeTab === 'offers' && (
          <div className="tab-content">
            <h2>All Offers</h2>
            <div className="filter">
              <label>Filter by State:</label>
              <select value={selectedState} onChange={(e) => setSelectedState(e.target.value)}>
                <option value="">All States</option>
                <option value="NJ">New Jersey</option>
                <option value="MI">Michigan</option>
                <option value="PA">Pennsylvania</option>
                <option value="WV">West Virginia</option>
              </select>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>Casino</th>
                  <th>State</th>
                  <th>Offer</th>
                  <th>Type</th>
                  <th>Deposit</th>
                  <th>Bonus</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {offers.map((offer) => (
                  <tr key={offer._id}>
                    <td>{offer.casinoName}</td>
                    <td>{offer.stateAbbreviation || offer.state}</td>
                    <td>{offer.offerName}</td>
                    <td>{offer.offerType}</td>
                    <td>${offer.expectedDeposit || 0}</td>
                    <td>${offer.expectedBonus || 0}</td>
                    <td><span className={`badge ${offer.source === 'ai-research' ? 'ai' : 'internal'}`}>
                      {offer.source === 'ai-research' ? 'AI Research' : 'Internal'}
                    </span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="tab-content">
            <h2>Research History</h2>
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Status</th>
                  <th>Started</th>
                  <th>Missing Casinos</th>
                  <th>New Offers</th>
                </tr>
              </thead>
              <tbody>
                {researches.map((research) => (
                  <tr key={research._id} className="clickable" onClick={() => setCurrentResearch(research)}>
                    <td>{research._id.substring(0, 8)}...</td>
                    <td><span className={`status ${research.status}`}>{research.status}</span></td>
                    <td>{new Date(research.startedAt).toLocaleDateString()}</td>
                    <td>{research.summary?.totalMissingCasinos || 0}</td>
                    <td>{research.summary?.totalNewOffers || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;