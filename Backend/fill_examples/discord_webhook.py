import requests

def main(args):
    """
    Example: Discord Webhook Integration
    Sends messages to Discord via webhook (e.g., scheduled Monday motivations).
    Great for scheduled triggers like cron jobs.
    """
    # Get message and webhook URL from args or use defaults
    message_content = args.get("body", {}).get("content", "Happy Monday! Let's make this week productive! 🌟")
    webhook_url = args.get("body", {}).get("webhook_url", "YOUR_DISCORD_WEBHOOK_URL_HERE")
    
    # Validate webhook URL
    if webhook_url == "YOUR_DISCORD_WEBHOOK_URL_HERE":
        return {
            "_shsf": "v2",
            "_code": 400,
            "_res": {
                "state": False,
                "error": "Please provide a valid Discord webhook URL in the request body"
            }
        }
    
    try:
        # Get webhook information to customize the sender name
        response = requests.get(webhook_url)
        
        if response.status_code == 200:
            print("Webhook is valid!")
            webhook_info = response.json()
            username = webhook_info.get("name", "SHSF Bot")
            username += " (via SHSF)"
            
            # Send the message
            send_data = {
                "content": message_content,
                "username": username
            }
            
            post_response = requests.post(webhook_url, json=send_data)
            
            if post_response.status_code == 204:
                print("Message sent successfully!")
                return {
                    "_shsf": "v2",
                    "_code": 200,
                    "_res": {
                        "state": True,
                        "message": "Discord message sent successfully",
                        "webhook_name": webhook_info.get("name")
                    }
                }
            else:
                return {
                    "_shsf": "v2",
                    "_code": post_response.status_code,
                    "_res": {
                        "state": False,
                        "error": "Failed to send message to Discord"
                    }
                }
        else:
            print("Invalid webhook URL. Please check the URL.")
            return {
                "_shsf": "v2",
                "_code": 400,
                "_res": {
                    "state": False,
                    "error": "Invalid webhook URL. Please check the URL."
                }
            }
    
    except Exception as e:
        return {
            "_shsf": "v2",
            "_code": 500,
            "_res": {
                "state": False,
                "error": str(e)
            }
        }

# Usage with trigger:
# Set up a cron trigger with this JSON payload:
# {
#   "content": "Happy Monday, @everyone! 🎉",
#   "webhook_url": "your-webhook-url-here"
# }
