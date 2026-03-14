# Mock Data

Store one real Synth API response per asset here as JSON files.
Backend falls back to these if the API is down or credits exhausted.

## File naming
```
{ASSET}_{HORIZON}.json
```

## Example files needed
```
BTC_24h.json
BTC_1h.json
ETH_24h.json
NVDAX_24h.json
TSLAX_24h.json
AAPLX_24h.json
GOOGLX_24h.json
SPYX_24h.json
SOL_24h.json
XAU_24h.json
```

## How to capture
Hit the Synth API once and save the response:
```bash
curl "https://api.synthdata.co/insights/prediction-percentiles?asset=BTC&horizon=24h" \
  -H "Authorization: Apikey YOUR_KEY" | python -m json.tool > BTC_24h.json
```

Or the backend will auto-save responses when `SAVE_MOCK_DATA=true` is set.
