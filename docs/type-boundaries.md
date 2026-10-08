# Type boundary inventory

This inventory is intentionally limited to the highest-risk boundaries. Update it
when an increment changes one of the counts below; do not convert values to casts
solely to reduce a count.

| Boundary | Baseline explicit `any` count | Current count | Next increment |
| --- | ---: | ---: | --- |
| UI trigger execution response and consumers | 3 | 0 | Validate the function execute response and stream chunks. |
| UI function execution service | 2 | 2 | Define the non-stream and streaming execution envelopes. |
| Backend execution request binding | 1 | 1 | Replace `z.any()` with a JSON-value schema while preserving arbitrary function payloads. |
| Backend auth context | 1 | 1 | Type the request context used by authentication helpers. |
| Backend storage request context | 2 | 2 | Type the storage route context and errors. |

The trigger boundary now reads JSON as `unknown`, validates its success envelope,
and treats malformed responses as a safe API failure. Function result payloads stay
`unknown` because functions may intentionally return any JSON value.
