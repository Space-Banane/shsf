# SHSF (Self-Hostable Serverless Functions)

All because i don't want to pay for AWS Lambda

## 🌟 Overview

SHSF allows you to deploy and manage serverless functions on your own hardware. It has a web interface, supports python as a main runtime and allows you to trigger functions via HTTP(S) requests or cron jobs.

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
2. **Create a function**: Click "Create Function", pick Python, write your code, and save.
3. **Run your function**:
   - Click "Run" in the UI
   - Use the provided HTTP API endpoint
   - Set up a schedule (cron) if needed

## Function Structure

Python function example:

```python
def main(args):
    # Your function logic here
    name = args.get('body', {}).get('name', 'World')
    return f"Hello, {name}!"
```


## Thanks for using (if you do)
Star the repo, complain about bugs. thanks
