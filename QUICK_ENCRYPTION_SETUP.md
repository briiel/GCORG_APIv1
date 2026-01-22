# 🚀 Quick Start: Enabling Encryption

**Estimated Time**: 10 minutes  
**Skill Level**: Intermediate

---

## Prerequisites

- ✅ Node.js installed
- ✅ Access to server/repository
- ✅ Basic understanding of environment variables

---

## Step 1: Generate Encryption Key (2 min)

```bash
cd GCORG_APIv1

# Generate encryption key
node scripts/generate_encryption_key.js
```

**Output:**
```
🔐 Encryption Key Generator
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Generated Encryption Key:
ENCRYPTION_KEY=a1b2c3d4e5f6...

⚠️  DO NOT COMMIT THIS KEY TO VERSION CONTROL!
```

---

## Step 2: Add to Environment Variables (1 min)

### Development (.env file)

```bash
# Open .env file
nano .env  # or your preferred editor

# Add this line (use YOUR generated key, not this example!)
ENCRYPTION_KEY=your_64_character_hex_key_here
```

### Production (Render/Heroku/etc.)

**Render:**
1. Go to Dashboard → Your Service → Environment
2. Add variable: `ENCRYPTION_KEY` = `your_generated_key`
3. Save changes (will trigger redeploy)

**Heroku:**
```bash
heroku config:set ENCRYPTION_KEY=your_generated_key
```

---

## Step 3: Verify Installation (1 min)

```bash
# Test encryption utility
node -e "const {encryptData, decryptData} = require('./src/utils/encryption'); const encrypted = encryptData('test'); console.log('✅ Encryption works:', decryptData(encrypted) === 'test');"
```

**Expected Output:**
```
✅ Encryption works: true
```

---

## Step 4: Enable Secure Storage (Frontend) (3 min)

### Update Angular App Module

```typescript
// src/app/app.config.ts or app.module.ts
import { SecureStorageService } from './services/secure-storage.service';

export const appConfig: ApplicationConfig = {
  providers: [
    // ... existing providers
    SecureStorageService,
    // ... rest of config
  ]
};
```

### Initialize on Startup

```typescript
// src/app/app.component.ts
import { SecureStorageService } from './services/secure-storage.service';

export class AppComponent implements OnInit {
  constructor(private secureStorage: SecureStorageService) {}

  async ngOnInit() {
    // Initialize encryption for this session
    await this.secureStorage.initializeKey();
  }
}
```

---

## Step 5: Update Auth Service (3 min)

```typescript
// src/app/services/rbac-auth.service.ts
import { SecureStorageService } from './secure-storage.service';

export class RbacAuthService {
  constructor(
    private http: HttpClient,
    private router: Router,
    private secureStorage: SecureStorageService  // Add this
  ) {
    // Initialize secure storage
    this.secureStorage.initializeKey();
  }

  // Replace saveToken method
  async saveToken(token: string): Promise<void> {
    await this.secureStorage.setSecure(this.TOKEN_KEY, token);
  }

  // Replace getToken method
  async getToken(): Promise<string | null> {
    return await this.secureStorage.getSecure(this.TOKEN_KEY);
  }

  // Update login to be async
  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, { email, password })
      .pipe(
        tap(async response => {  // Make this async
          const token = response?.token ?? response?.data?.token;
          if (token) {
            await this.saveToken(token);  // Now awaits
            const decoded = this.getDecodedToken();
            this.currentUserSubject.next(decoded);
          }
        })
      );
  }
}
```

---

## That's It! ✅

Your system now has:
- ✅ AES-256-GCM encryption utilities
- ✅ Secure localStorage with Web Crypto API
- ✅ Enhanced security headers
- ✅ Response sanitization

---

## Optional: Encrypt Existing Data

If you have existing sensitive data to encrypt:

```bash
# Create migration script
touch GCORG_APIv1/scripts/migrate_existing_data.js

# Add migration code (see ENCRYPTION_GUIDE.md for examples)
# Run migration
node scripts/migrate_existing_data.js
```

---

## Troubleshooting

### Error: "ENCRYPTION_KEY not found"
**Solution**: Make sure .env file has ENCRYPTION_KEY variable

### Error: "Web Crypto not available"
**Solution**: Ensure using HTTPS (or localhost for development)

### Error: "Invalid encrypted data format"
**Solution**: Data might not be encrypted yet. Run migration or check for typos.

---

## Next Steps

1. ✅ Read [SECURITY_AUDIT_REPORT.md](../SECURITY_AUDIT_REPORT.md) for full details
2. ✅ Read [ENCRYPTION_GUIDE.md](ENCRYPTION_GUIDE.md) for advanced usage
3. ✅ Test in development before deploying to production
4. ✅ Set up monitoring for encryption errors

---

**Need Help?** Check the documentation or review the code comments in:
- `src/utils/encryption.js`
- `src/middleware/secureResponse.js`
- `src/app/services/secure-storage.service.ts`
