# Casino & Offer AI Researcher

An intelligent system for discovering licensed casinos across US states and researching promotional offers using Claude AI and web search.

## 🎯 Project Overview

This system automatically:
1. **Discovers** all licensed casinos in NJ, MI, PA, WV using official state gaming commission sources
2. **Researches** current promotional offers for each casino via AI-powered web search
3. **Compares** discovered offers against existing internal database
4. **Identifies** missing casinos and superior promotional opportunities
5. **Reports** findings through an interactive dashboard

## 🏗️ Architecture

### Tech Stack
- **Frontend**: React 18 + Vite + TypeScript
- **Backend**: Node.js + Express
- **Database**: MongoDB
- **AI**: Claude 4.5 Sonnet API with web search
- **Deployment**: Vercel (frontend) + Railway/Render (backend)

### Data Flow
```
External API → Parse Existing Offers → MongoDB
                        ↓
                  Initial Casinos
                        ↓
                  Claude Research
                        ↓
           (Casino Discovery + Offer Research)
                        ↓
         Compare → Generate Reports → MongoDB
                        ↓
                  React Dashboard
```

## 📦 Installation

### Prerequisites
- Node.js 18+ and npm
- MongoDB database (local or MongoDB Atlas cloud)
- OperRouter key for AI
- Git

### Step 1: Clone Repository
```bash
git clone <your-repo-url>
cd casino-ai-researcher
```

### Step 2: Backend Setup
```bash
# Create .env file in root
cat > .env << EOF
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/casino-db
OPENROUTER_API_KEY=sk-ant-xxxxxxxxxxxxx
PORT=5000
NODE_ENV=development
EOF

# Install dependencies
npm install

# Start backend
npm run dev
```

### Step 3: Frontend Setup
```bash
# Create frontend app with Vite
npm create vite@latest frontend -- --template react
cd frontend

# Create .env file
cat > .env << EOF
VITE_API_URL=http://localhost:5000
EOF

# Install dependencies
npm install

# Copy App.jsx and App.css into frontend/src
# Replace the contents of src/App.jsx with the provided App.jsx
# Replace the contents of src/App.css with the provided App.css

# Start frontend dev server
npm run dev
```

### Step 4: Access Application
- Frontend: http://localhost:5173
- Backend API: http://localhost:5000
- API Docs available at `/api/casinos`, `/api/offers`, `/api/research/runs`

## 🚀 Running the System

### 1. Initialize Existing Offers
Click the **"📥 Initialize"** button on the dashboard to:
- Fetch current promotional offers from the provided API endpoint
- Parse and store in MongoDB
- Extract existing casinos into database

### 2. Run Full Research
Click the **"🔍 Run Full Research"** button to:
- Discover all licensed casinos in NJ, MI, PA, WV using Claude + web search
- Cross-reference against existing casinos to identify missing ones
- Research current promotional offers for each casino
- Compare with internal database to find new/superior offers
- Generate comprehensive comparison report

**Note**: Research typically takes 5-15 minutes depending on number of casinos. The system handles this asynchronously.

### 3. Review Results
- **Dashboard**: Overview of discovered casinos and new offers
- **Missing Casinos**: Casinos in official records not yet in your system
- **Offer Comparisons**: Side-by-side comparison of current vs discovered offers
- **All Casinos**: Searchable table of all discovered casinos
- **All Offers**: Complete offer database with filtering
- **History**: Research run history and metrics

## 📊 Database Schema

### Casinos Collection
```javascript
{
  _id: ObjectId,
  name: "Casino Name",
  stateAbbreviation: "NJ",
  state: "New Jersey",
  casinodb_id: 0,
  website: "https://casino.com",
  licenseNumber: "LIC123",
  discovered: true,  // AI-discovered vs internal
  createdAt: Date,
  lastUpdated: Date
  
}
```

### Offers Collection
```javascript
{
  _id: ObjectId,
  casinoId: ObjectId,
  casinoName: "Casino Name",
  state: "New Jersey",
  stateAbbreviation: "NJ",
  offerName: "Welcome Bonus",
  offerType: "deposit-match"
  description: "50% up to $500",
  expectedDeposit: 25
  expectedBonus: 12.5
  bonusType: "welcome",
  terms: "Wagering requirements...",
  source: "ai-research",  // or "internal-api"
  discoveredDate: Date,
  verified: false
}
```

### ResearchRuns Collection
```javascript
{
  _id: ObjectId,
  status: "completed",  // pending, in-progress, completed, failed
  startedAt: Date,
  completedAt: Date,
  missingCasinos: [
    { state: "NJ", casinos: ["Casino A", "Casino B"] }
  ],
  offerComparisons: [...],
  summary: {
    totalMissingCasinos: 5,
    totalNewOffers: 12,
    statesProcessed: ["NJ", "MI", "PA", "WV"]
  }
}
```

## 🔌 API Endpoints

### Research Management
- `POST /api/research/init` - Fetch and store existing offers
- `POST /api/research/run` - Trigger full research
- `GET /api/research/runs` - List research history
- `GET /api/research/runs/:id` - Get specific research run

### Data Access
- `GET /api/casinos` - List all casinos (supports `?state=NJ` filter)
- `GET /api/offers` - List all offers (supports `?state=NJ` filter)
- `GET /api/dashboard/summary` - Dashboard metrics
- 

## ⚙️ Configuration

### Environment Variables

**Backend (.env)**
```
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/db
ANTHROPIC_API_KEY=sk-ant-xxxx
PORT=5000
NODE_ENV=development
```

**Frontend (.env)**
```
VITE_API_URL=http://localhost:5000
```

### Rate Limiting & Costs

The system implements several efficiency measures:
- **Caching**: Results cached for 24 hours
- **Batching**: Research runs process all states in one session
- **Exponential Backoff**: Automatic retry with delays
- **Cost Control**: ~$0.10-0.50 per full research run using Claude Sonnet

## 🤖 AI Integration Details

### OpenRouter Claude API Usage

**Casino Discovery Prompt**
```
Find all currently licensed and operational casinos in [STATE] 
according to official state gaming commission sources.
Return JSON with name, website, licenseNumber, city.
```

**Offer Research Prompt**
```
Research current casino promotional offers for [CASINO_NAME] in [STATE].
Focus on casino bonuses, NOT sports betting.
Return JSON with title, description, bonusAmount, bonusType, terms.
```

### Response Parsing
- Responses structured as JSON for reliable parsing
- Fallback error handling if parsing fails
- Validation of extracted data before storage

## 📈 Performance Considerations

### Optimization Strategies
1. **Async Processing**: Research runs as background jobs
2. **Batch Queries**: Groups related requests
3. **Connection Pooling**: MongoDB connection optimization
4. **Caching**: Prevents duplicate API calls
5. **Rate Limiting**: Respects API quotas

### Scalability
- MongoDB indexing on `state`, `casinoName` for quick lookups
- Pagination support for large datasets
- Horizontal scaling ready (stateless backend)
- Flexibility in AI Usage Through OpenRouter

## 🐛 Troubleshooting

### MongoDB Connection Issues
```
Error: connect ECONNREFUSED
→ Verify MONGODB_URI in .env
→ Check if MongoDB service is running
→ Test connection: mongosh "mongodb+srv://user:pass@..."
```

### OpenRouter API Errors
```
Error: 401 Unauthorized
→ Verify OPENROUTER_API_KEY=is correct
→ Check API key hasn't expired
→ Ensure key has appropriate permissions
```

### CORS Issues
```
Error: Cross-Origin Request Blocked
→ Verify CORS middleware enabled in server.js
→ Check VITE_API_URL matches backend URL
→ Ensure backend is running on correct port
```

### Research Timeout
```
If research takes >15 minutes:
→ Verify Open Router rate limits
→ Verify MongoDB connection stability
→ Consider running research during off-peak hours
```

## 📋 Workflow Examples

### Example 1: First Run
1. Start backend: `npm run dev`
2. Start frontend: `npm run dev:frontend`
3. Click "Initialize" to load existing offers
4. Review dashboard stats
5. Click "Run Research" to discover new casinos and offers
6. Wait for completion (5-15 minutes)
7. Review "Missing Casinos" tab for gaps
8. Check "Offer Comparisons" for new opportunities
9. Delete Offers that does not satisfy requirements

### Example 2: Scheduled Research
```bash
# Add to crontab (runs daily at 2 AM)
0 2 * * * curl -X POST http://localhost:5000/api/research/run
```

### Example 3: Export Results
```bash
# Export missing casinos to CSV
db.researchruns.findOne({ status: "completed" }, { missingCasinos: 1 })
```

## 🔒 Security Considerations

- **API Keys**: Store in .env, never commit
- **Database**: Use MongoDB Atlas IP whitelist
- **CORS**: Configure for specific domains in production
- **Rate Limiting**: Consider implementing per-user limits
- **Input Validation**: Sanitize all user inputs (already done)

## 📈 Future Enhancements

1. **Multi-source Verification**: Cross-reference casinos through multiple sources
2. **Historical Tracking**: Track offer changes over time
3. **Email Alerts**: Notify on new superior offers
4. **ML Scoring**: Machine learning for offer quality assessment
5. **Mobile App**: React Native companion app
6. **Advanced Scheduling**: Hourly/daily/weekly runs with UI controls
7. **Offer Expiration**: Track and remove expired offers
8. **Competitor Benchmarking**: Compare your offers vs competitors
9. **AI Model Comparison**: Usage of other AI and testing effectivity compared to current model used (sonnet from CLAUDE)

## 📞 Support & Questions

For issues or questions:
1. Check the Troubleshooting section
2. Review Claude API documentation
3. Check MongoDB documentation
4. OpenRouter API docs at https://openrouter.ai/docs

## 📄 License

This project is provided as-is for research and development purposes.

## 🎓 Key Technical Decisions & Trade-offs

### Decision: AI-Powered Research vs Traditional Web Scraping
**Why**: Superior at understanding varying website structures and gaming commission formats
**Trade-off**: Higher API costs vs lower maintenance burden

### Decision: Async Research Runs
**Why**: Prevents UI blocking, allows system to handle multiple concurrent requests
**Trade-off**: Slightly more complex architecture vs better user experience

### Decision: MongoDB
**Why**: Flexible schema accommodates varying casino/offer data structures
**Trade-off**: NoSQL vs relational database complexity

### Decision: Claude 4 Sonnet
**Why**: Best balance of reasoning capability, cost, and speed for this task
**Trade-off**: Slightly higher cost than cheaper models, but superior accuracy

### Decision: React Dashboard
**Why**: Real-time updates, interactive filtering, responsive design
**Trade-off**: Frontend complexity vs superior UX

## ⏱️ Time Estimates

- **Initial Setup**: 15 minutes
- **First Research Run**: 5-15 minutes
- **Dashboard Review**: 10 minutes
- **Production Deployment**: 30 minutes
- **Custom Modifications**: Variable

## ✅ Success Criteria Checklist

- [] MongoDB connected and casinos/offers stored
- [ ] Claude API integrated and working
- [ ] Initial 4 states casinos discovered successfully
- [ ] Missing casinos identified and displayed
- [ ] New offers found and compared
- [ ] Dashboard responsive and functional
- [ ] Research run completes without errors
- [ ] Results can be exported/reviewed
