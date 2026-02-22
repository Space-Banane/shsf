# SHSF (Self-Hostable Serverless Functions) V2
![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/Space-Banane/shsf/ci.yml)
![Discord](https://img.shields.io/discord/1475098530505953441?style=flat)
![GitHub code size in bytes](https://img.shields.io/github/languages/code-size/Space-Banane/shsf)

Because why would you use AWS Lambda when you have a raspberry pi, home lab, or even a old laptop lying around? 

> SHSF is a self-hostable serverless functions platform that allows you to run your code without worrying about infrastructure. It's like having your own mini AWS Lambda, but on your own hardware.

## 🌟 Overview

SHSF has a web interface, supports Python and Go as main runtimes and allows you to trigger functions via HTTP(S) requests or cron jobs.

## Requiremnets
- Docker with Compose plugin
- 512MB Ram minimum (not really but if you have less, might not even compile)
- A modern-ish browser

## Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/Space-Banane/shsf.git
   cd shsf
   ```

2. **Configure environment**

   ```bash
   cp .env.example .env
   nano .env  # Edit configuration, add database details and stuff
   # If needed there is a commented database section in the docker-compose.yml
   ```

3. **Start the services**

   ```bash
   docker-compose up -d
   ```

4. **Access the interface**

   Open your browser and navigate to `http://localhost:3000` (or your configured port)

## Usage

1. **Open the web interface** and register (first user becomes admin).
2. **Create a function**: Click "Create Function", pick Python or Go, write your code, and save.
3. **Run your function**:
   - Click "Run" in the UI
   - Use the provided HTTP API endpoint
   - Set up a schedule (cron) if needed

## Function Structure

### Python function example:

```python
def main(args):
    # Your function logic here
    name = args.get('body', {}).get('name', 'World')
    return f"Hello, {name}!"
```

### Go function example:

```go
package main

import "fmt"

func main_user(args interface{}) (interface{}, error) {
    // Your function logic here
    payload, _ := args.(map[string]interface{})
    name := "World"
    if body, ok := payload["body"].(map[string]interface{}); ok {
        if n, ok := body["name"].(string); ok {
            name = n
        }
    }
    return fmt.Sprintf("Hello, %s!", name), nil
}
```


## Thanks for using (if you do)
Star the repo, complain about bugs. thanks
