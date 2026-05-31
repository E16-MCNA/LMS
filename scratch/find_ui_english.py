import os
import re

src_dir = r"d:\LMS\src"

# Regex patterns to find potential UI texts:
# 1. JSX text: >Text< (anything that isn't < or >)
jsx_text_pat = re.compile(r'>\s*([^<>{}]+)\s*<')
# 2. String props: placeholder="Text", title="Text", label="Text"
prop_pat = re.compile(r'\b(placeholder|title|label)\s*=\s*["\']([^"\']+)["\']')
# 3. Text in braces: {"Text"} or {'Text'}
braces_pat = re.compile(r'{\s*["\']([^"\']+)["\']\s*}')

# English words to skip (e.g., standard tech terms, classes, SVG, roles)
SKIP_WORDS = {
    "svg", "path", "d", "fill", "viewBox", "stroke", "xmlns", "http", "www", "w3",
    "true", "false", "null", "undefined", "role", "roleLabel", "roleLabel(currentUser.role)",
    "admin", "teacher", "student", "finance", "sale", "advisor", "parent", "manager",
    "all", "active", "inactive", "pending", "approved", "rejected", "W", "A", "P", "L", "E",
    "submit", "button", "text", "number", "email", "password", "date", "checkbox",
    "id", "name", "value", "type", "onclick", "onsubmit", "onchange", "className",
    "SIS", "LMS", "MCNA", "INC", "VND", "USD", "VND/Tháng", "VND/Khóa", "VND/Học viên",
    "MB", "VietQR", "QR", "QR Code", "GPA", "CSV", "Excel", "Express", "Vite", "JSON",
    "Docker", "Kubernetes", "gRPC", "Kafka", "DevOps", "Bootcamp", "API", "DB", "SMTP", "2FA",
    "Express Route", "GitHub", "Lab", "TCP/IP", "TCP", "IP", "ingress", "spark", "spark streaming",
    "Python", "NumPy", "Pandas", "Bootcamp Full-Stack", "Bootcamp Data Engineering", "Microservices"
}

def clean_and_check(text, filepath):
    text = text.strip()
    if not text:
        return False
    # If contains Vietnamese accents, it's already translated
    if re.search(r'[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]', text, re.IGNORECASE):
        return False
    # Check if all words are standard English/ASCII letters or digits/punctuation
    if not re.match(r'^[a-zA-Z0-9\s\.,\-\!\?:\/\(\)\@\#\%\&\*\\\'\"“”‘’]*$', text):
        return False
    # Split into words and see if any word is meaningful English
    words = [w.strip(".,!?():;\"'“”‘’").lower() for w in text.split()]
    words = [w for w in words if w]
    if not words:
        return False
    # If all words are in skip set, skip
    if all(w in SKIP_WORDS or w.isdigit() or len(w) <= 1 for w in words):
        return False
        
    # Check if it looks like a CSS class name, variable name, or imports
    if any(text.startswith(prefix) for prefix in ["bg-", "text-", "border-", "hover:", "focus:", "p-", "m-", "flex", "grid", "rounded-", "shadow-"]):
        return False
    if filepath.endswith('.ts') and not filepath.endswith('.tsx'):
        # Usually code constants in ts files, but let's inspect if they look like sentences
        if len(words) < 2:
            return False
            
    return True

findings = []

for root, dirs, files in os.walk(src_dir):
    for file in files:
        if file.endswith(('.tsx', '.ts')):
            path = os.path.join(root, file)
            rel_path = os.path.relpath(path, src_dir)
            
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
            except Exception as e:
                continue
                
            lines = content.splitlines()
            for idx, line in enumerate(lines):
                line_num = idx + 1
                stripped = line.strip()
                # Skip comments
                if stripped.startswith("//") or stripped.startswith("/*") or stripped.startswith("*"):
                    continue
                if "console.log" in line or "import " in line:
                    continue
                    
                # Search JSX text
                for m in jsx_text_pat.finditer(line):
                    text = m.group(1)
                    if clean_and_check(text, file):
                        findings.append((rel_path, line_num, f"JSX text: '{text}'", line.strip()))
                        
                # Search prop text
                for m in prop_pat.finditer(line):
                    prop, text = m.groups()
                    if clean_and_check(text, file):
                        findings.append((rel_path, line_num, f"Prop {prop}='{text}'", line.strip()))
                        
                # Search braces text
                for m in braces_pat.finditer(line):
                    text = m.group(1)
                    if clean_and_check(text, file):
                        findings.append((rel_path, line_num, f"Braces text: '{text}'", line.strip()))

output_path = r"d:\LMS\scratch\ui_english_findings.txt"
with open(output_path, "w", encoding="utf-8") as out:
    for f in findings:
        out.write(f"File: {f[0]} | Line: {f[1]} | Type: {f[2]} | Code: {f[3]}\n")

print(f"Scan finished. Found {len(findings)} potential UI English texts. Results written to scratch/ui_english_findings.txt")
