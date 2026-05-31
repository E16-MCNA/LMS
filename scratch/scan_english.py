import os
import re
import sys

components_dir = r"d:\LMS\src"

# Common English words that often appear as labels or buttons in UI
ENGLISH_WORDS = [
    r"\bBalance\b", r"\bPaid\b", r"\bUnpaid\b", r"\bDue\b", r"\bTuition\b", r"\bHistory\b",
    r"\bStatus\b", r"\bActive\b", r"\bInactive\b", r"\bSuspended\b", r"\bPending\b", r"\bApproved\b",
    r"\bRejected\b", r"\bTotal\b", r"\bAmount\b", r"\bDate\b", r"\bDescription\b", r"\bAction\b",
    r"\bEdit\b", r"\bDelete\b", r"\bSave\b", r"\bCancel\b", r"\bSubmit\b", r"\bCreate\b", r"\bAdd\b",
    r"\bSearch\b", r"\bFilter\b", r"\bRole\b", r"\bName\b", r"\bEmail\b", r"\bPhone\b", r"\bAddress\b",
    r"\bWarning\b", r"\bReport\b", r"\bChart\b", r"\bAnalytics\b", r"\bOverview\b", r"\bDashboard\b",
    r"\bSchedule\b", r"\bTimetable\b", r"\bGrade\b", r"\bAssignment\b", r"\bQuiz\b", r"\bClass\b",
    r"\bCourse\b", r"\bStudent\b", r"\bTeacher\b", r"\bParent\b", r"\bAdvisor\b", r"\bFinance\b",
    r"\bReception\b", r"\bRegistration\b", r"\bAttendance\b", r"\bNotification\b", r"\bSettings\b",
    r"\bProfile\b", r"\bLogout\b", r"\bWelcome\b", r"\bDetails\b", r"\bView\b", r"\bHistory\b"
]

def scan_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            lines = f.readlines()
    except Exception as e:
        return []
        
    findings = []
    for idx, line in enumerate(lines):
        line_num = idx + 1
        stripped = line.strip()
        if stripped.startswith("//") or stripped.startswith("/*") or stripped.startswith("*"):
            continue
        if "console.log" in line or "import " in line or "className=" in line or "style=" in line:
            continue
            
        for word in ENGLISH_WORDS:
            pattern = re.compile(rf'(?:["\'\>\s]|^){word}(?:["\'\<\s\.\:\!\?]|$)', re.IGNORECASE)
            if pattern.search(line):
                # Filter out pure code/api/function declarations
                if "interface " in line or "type " in line or "const " in line and "=>" in line:
                    # Let's still scan them, but check if there's actual UI text
                    pass
                findings.append((line_num, line.strip(), word))
                break
                
    return findings

output_path = r"d:\LMS\scratch\english_findings.txt"
with open(output_path, "w", encoding="utf-8") as out:
    for root, dirs, files in os.walk(components_dir):
        for file in files:
            if file.endswith(('.tsx', '.ts')):
                path = os.path.join(root, file)
                res = scan_file(path)
                if res:
                    rel_path = os.path.relpath(path, components_dir)
                    out.write(f"\n--- {rel_path} ---\n")
                    for line_num, content, word in res:
                        out.write(f"  Line {line_num} (matched '{word}'): {content}\n")

print("Scan completed successfully. Results written to scratch/english_findings.txt")
