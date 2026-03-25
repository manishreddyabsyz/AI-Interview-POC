#!/usr/bin/env python3
"""
Setup script for AI Interviewer Backend
"""
import subprocess
import sys
import os

def check_python_version():
    """Check if Python version is 3.9+"""
    if sys.version_info < (3, 9):
        print("Error: Python 3.9 or higher is required")
        sys.exit(1)
    print(f"✓ Python {sys.version_info.major}.{sys.version_info.minor} detected")

def install_dependencies():
    """Install Python dependencies"""
    print("\nInstalling dependencies...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
        print("✓ Dependencies installed successfully")
    except subprocess.CalledProcessError:
        print("Error: Failed to install dependencies")
        sys.exit(1)

def check_env_file():
    """Check if .env file exists"""
    if not os.path.exists(".env"):
        print("\n⚠ Warning: .env file not found")
        print("Please create a .env file with your configuration:")
        print("  cp .env.example .env")
        print("  # Then edit .env with your Cloudinary credentials")
    else:
        print("✓ .env file found")

def check_ollama():
    """Check if Ollama is running"""
    print("\nChecking Ollama...")
    try:
        import httpx
        response = httpx.get("http://localhost:11434/api/tags", timeout=5)
        if response.status_code == 200:
            print("✓ Ollama is running")
        else:
            print("⚠ Ollama might not be running properly")
    except:
        print("⚠ Warning: Cannot connect to Ollama")
        print("  Make sure Ollama is installed and running:")
        print("  ollama serve")
        print("  ollama pull qwen2.5:7b-instruct")

def main():
    print("=== AI Interviewer Backend Setup ===\n")
    check_python_version()
    install_dependencies()
    check_env_file()
    check_ollama()
    print("\n✓ Setup complete!")
    print("\nTo start the server:")
    print("  python main.py")

if __name__ == "__main__":
    main()
