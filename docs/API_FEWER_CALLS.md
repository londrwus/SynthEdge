How to Get More from the Synth API with Fewer Calls The SynthData API
has several endpoints: prediction percentiles, volatility, option
pricing, liquidation probability, LP bounds, Polymarket comparisons. If
you\'re calling each one separately for every asset you track, you may
be making more calls than you need to. Understanding the relationship
between the percentiles endpoint and the insight endpoints, as well as
how different configurations can impact credit usage, is key to using
the API efficiently. WebSocket vs. REST WebSocket pushes a new message
approximately every 30 seconds, and each message counts against your
credits. REST with caching, you\'ll catch a new forecast within one poll
cycle of it landing without paying for the messages in between. Use
WebSocket if your application genuinely requires push delivery;
otherwise REST is the more credit efficient. Note that the number of
credits also compounds with the number of Synth Insights APIs you use.
Also note that credit usage compounds with the number of Synth Insights
APIs you use. We see that most users pull from multiple insight
endpoints at the same time, which multiplies the total number of API
calls. The Percentiles Endpoint vs. the Insight Endpoints The insight
endpoints (volatility, option pricing, liquidation, LP bounds,
Polymarket insights) are calculated directly from the full set of 1,000
simulated price paths that miners submit. That gives them a level of
precision that the percentile summary alone can\'t fully replicate. If
you need the API\'s own implementation of a specific calculation, those
endpoints are the right tool. The /insights/prediction-percentiles
endpoint summarises those same raw paths into 9 percentile levels across
every timestep in the horizon. It\'s a compressed view of the same
underlying forecast, not the source data itself. It gives you enough
shape to derive reasonable approximations of several signals locally,
and because it\'s a single call, it\'s a more efficient foundation if
you\'re building something that needs more than one type of output. The
decision comes down to what you\'re building. Calling individual insight
endpoints makes sense when you need one specific output and want the
API\'s own calculation. Fetching the percentiles and deriving locally
makes sense when you\'re combining multiple signals, running your own
models on top of the distribution, or want to minimize total call
volume. WebSocket pushes a new message every 30 seconds, and each
message counts against your credits. REST with caching you\'ll catch a
new forecast within one poll cycle of it landing without paying for the
messages in between. Use WebSocket if your application genuinely
requires push delivery; otherwise REST is the more credit-efficient
default. What You Can Reasonably Derive from the Percentiles Implied
volatility: the spread between percentile levels at a given timestep
reflects the forecast\'s uncertainty at that horizon. The width between
the 5th and 95th percentile, expressed as a percentage of current price,
gives you a usable approximation of implied volatility range.
Directional probability: the position of the 50th percentile relative to
current price shows the distribution\'s directional lean. Combine this
with the spread to gauge conviction. Liquidation risk: if you know a
position\'s liquidation price, you can estimate its probability by
finding where that price level falls within the percentile bands at your
relevant horizon. LP range placement: the percentile spread gives you a
probability-bounded price range. Setting your LP range to the 20th--80th
percentile band, for example, targets a 60% probability of price staying
in range over the horizon. Where the Insight Endpoints Have an Edge
Option pricing is a good example of where the dedicated endpoint is
worth the call. Pricing options accurately requires the full shape of
the distribution, including tail behaviour, which 9 percentile levels
only approximate. If precise option pricing is central to your use case,
/insights/option-pricing is running those calculations on the full 1,000
paths and will produce tighter results than a percentile-based
approximation. Similarly, liquidation probability at specific price
levels and LP bounds calculations benefit from the full path data when
precision matters. The percentile approach gets you in the right area,
but the insight endpoints give you the exact figure the network
computed. The Practical Architecture If your application needs multiple
signals per asset, fetch /insights/prediction-percentiles once per poll
cycle, cache it, and derive what you can locally. Add specific insight
endpoint calls only where the precision difference is meaningful for
your use case. If you\'re only using one type of signal, call the
relevant insight endpoint directly and don\'t bother with the full
distribution. Either way, avoid architectures where individual
downstream components each trigger their own API call for the same asset
and horizon. One fetch, shared across everything that needs it, is the
principle that reduces call volume regardless of which endpoint you\'re
using.
