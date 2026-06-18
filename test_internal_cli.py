import sys
from spotdl.console.entry_point import console_entry_point
import os

try:
    print("Running spotdl internally...")
    # Let's run spotdl save internally
    sys.argv = ["spotdl", "save", "Mon Laferte - Tu Falta De Querer", "--save-file", "test_internal.spotdl"]
    console_entry_point()
    print("Completed! File exists:", os.path.exists("test_internal.spotdl"))
except SystemExit as se:
    print("SystemExit code:", se.code)
    print("Completed! File exists:", os.path.exists("test_internal.spotdl"))
except Exception as e:
    print("Error:", e)
