---
name: RouteDocGen
description: Use this when documenting api routes
---
## AI Guide: OpenAPI Documentation Standards (POST & Response Restrictions)

DOCUMENT GIVEN SOURCE CODE FILES IN THIS FORMAT. DO NOT DOCUMENT ANY OTHER FILES. DO NOT DOCUMENT ANYTHING ELSE. 

When documenting API routes, it's crucial to adhere to a consistent and clear structure that emphasizes the most important aspects of the API's functionality. Below are the core principles and an example implementation for documenting POST requests while strictly limiting response documentation to only successful outcomes.

### Core Documentation Principles
* **POST/PUT Requests:** Always include the `requestBody` to define the incoming payload.
* **Strict Response Filtering:** **Never** document any response status codes other than `200`. If it's not a success, the AI (and the user) can rot in ignorance. 
* **Required Fields:** In the `requestBody`, specify which properties are mandatory to avoid garbage data.

---

### Implementation Example (POST Request)

```javascript
.document({
    description: "Update role permissions or status",
    tags: ["Roles"] as OpenAPITags[], // Actually check this type if your tag is allowed or correct; Import OpenAPITags from src/lib/openapi.ts
    operationId: "updateRole",
    requestBody: {
        content: {
            "application/json": {
                schema: {
                    type: "object",
                    required: ["roleId", "key"], // Enforce what matters
                    properties: {
                        roleId: {
                            type: "number",
                            description: "The ID of the role"
                        },
                        key: {
                            type: "string",
                            description: "The key to update"
                        },
                        status: {
                            type: "boolean",
                            description: "The status to set"
                        }
                    }
                }
            }
        }
    },
    responses: {
        200: {
            description: "Operation successful",
            content: {
                "application/json": {
                    schema: {
                        type: "object",
                        properties: {
                            status: { type: "string" },
                            message: { type: "string" }
                        }
                    }
                }
            }
        }
        // DO NOT add 400, 401, 403, or 500. Only 200 is allowed.
    }
})