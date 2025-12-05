# JSON Template Importer

This script automatically imports poker table templates from JSON files to the remote API.

## Usage

1. Create a `templates` directory in the same location as `import_all_templates.py`:
   ```bash
   mkdir templates
   ```

2. Place your JSON template files in the `templates` directory. The script supports two formats:
   - **Single template** (JSON object):
     ```json
     {
       "backend": { ... },
       "ui": { ... }
     }
     ```
   - **Multiple templates** (JSON array):
     ```json
     [
       {
         "backend": { ... },
         "ui": { ... }
       },
       {
         "backend": { ... },
         "ui": { ... }
       }
     ]
     ```

3. Run the import script:
   ```bash
   python3 import_all_templates.py
   ```

## Requirements

- Python 3.6 or higher
- `requests` library (already included in project dependencies)

## Template Format

Each template must have:
- `backend` object with `template_name` field (used for identification)
- `ui` object with display settings

See the example templates in the repository for the complete structure.

## Output

The script provides detailed console output:
- 📄 Files being read
- Total templates loaded
- Progress for each template upload
- ✅ Success or ❌ Error status for each upload
- Final summary with success/failure counts

## Example Output

```
🚀 Starting Template Import Process

📄 Reading file: nlhe_templates.json
📄 Reading file: omaha_templates.json

Loaded total templates: 35

[1/35] Importing: Micro Stakes NLHE 6-Max
   ✅ Success
[2/35] Importing: Micro Stakes NLHE 9-Max
   ❌ Error 409: {"detail":"Template with this name already exists."}
[3/35] Importing: Low Stakes PLO 6-Max
   ✅ Success
...

--------------------------------
Import completed.
Success: 34
Failed:  1
--------------------------------
```

## Notes

- The `templates` directory is ignored by git, so your template files won't be committed
- Non-JSON files in the templates directory are automatically ignored
- Invalid JSON files will show an error but won't stop the import process
- The script uses the API endpoint: `https://poker.shahin8n.sbs/api/table-templates`
- Authentication is handled automatically with the admin token
