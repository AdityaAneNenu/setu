#!/usr/bin/env python
import subprocess
import sys
import os

# Change to project directory
os.chdir(r"E:\setu-pm-ajay\setu-pm-ajay-main (4)\setu-pm-ajay-main")

# Run Django tests
result = subprocess.run(
    [sys.executable, "manage.py", "test", "core.tests", "--verbosity=2", "--no-input"],
    capture_output=False,
)

sys.exit(result.returncode)
