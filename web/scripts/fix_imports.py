import os
import re

files_to_fix = [
    {
        "path": "c:/Felix/Felano Tech/Projects/Shopyos/web/src/pages/admin/FlashSales.tsx",
        "search": "FiCheckCircle, FiXCircle, FiClock, FiPlus, FiTag, FiSearch",
        "replace": "FiCheckCircle, FiXCircle, FiClock, FiPlus, FiTag"
    },
    {
        "path": "c:/Felix/Felano Tech/Projects/Shopyos/web/src/pages/admin/Hubs.tsx",
        "search": "FiMapPin, FiTruck, FiPlus, FiCheckCircle",
        "replace": "FiMapPin, FiTruck, FiPlus"
    },
    {
        "path": "c:/Felix/Felano Tech/Projects/Shopyos/web/src/pages/admin/ListingFees.tsx",
        "search": "FiDollarSign, FiEdit2, FiPlus, FiAlertCircle",
        "replace": "FiDollarSign, FiPlus"
    },
    {
        "path": "c:/Felix/Felano Tech/Projects/Shopyos/web/src/pages/admin/Payouts.tsx",
        "search": "FiCreditCard, FiCheckCircle, FiClock, FiXCircle",
        "replace": "FiCreditCard, FiCheckCircle, FiXCircle"
    },
    {
        "path": "c:/Felix/Felano Tech/Projects/Shopyos/web/src/pages/admin/StoreManagement.tsx",
        "search": "FiMoreVertical, FiCheckCircle, FiXCircle, FiClock",
        "replace": "FiCheckCircle, FiXCircle, FiClock"
    },
    {
        "path": "c:/Felix/Felano Tech/Projects/Shopyos/web/src/pages/admin/Support.tsx",
        "search": "FiMessageSquare, FiCheckCircle, FiXCircle",
        "replace": "FiMessageSquare, FiXCircle"
    }
]

for task in files_to_fix:
    try:
        with open(task["path"], "r", encoding="utf-8") as f:
            content = f.read()
        
        content = content.replace(task["search"], task["replace"])
        
        with open(task["path"], "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Fixed {task['path']}")
    except Exception as e:
        print(f"Error {task['path']}: {e}")

# Fix AppRoutes.tsx
try:
    with open("c:/Felix/Felano Tech/Projects/Shopyos/web/src/routes/AppRoutes.tsx", "r", encoding="utf-8") as f:
        content = f.read()
    
    # Remove BusinessDashboard import
    content = re.sub(r"const BusinessDashboard = [^\n]+\n", "", content)
    
    with open("c:/Felix/Felano Tech/Projects/Shopyos/web/src/routes/AppRoutes.tsx", "w", encoding="utf-8") as f:
        f.write(content)
    print("Fixed AppRoutes.tsx")
except Exception as e:
    print(f"Error AppRoutes.tsx: {e}")
