import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import createMemoryStore from "memorystore";
import { User, registerSchema } from "@shared/schema";
import { storage } from "./storage";

async function verifyCredentials(username: string, password: string): Promise<User | null> {
    const adminUser = process.env.ADMIN_USERNAME || "Admin";
    const adminPass = process.env.ADMIN_PASSWORD || "Dr.Admin";

    if (username === adminUser && password === adminPass) {
        return {
            id: "1",
            username: adminUser,
            role: "SuperAdmin",
            createdAt: new Date().toISOString(),
        };
    }

    // Check DB users
    const userRow = await storage.getUserByUsernameRow(username);
    if (userRow && userRow.password_hash === password) {
        return {
            id: userRow.id,
            username: userRow.username,
            role: userRow.role as "SuperAdmin" | "Staff",
            permissions: userRow.permissions,
            createdAt: userRow.createdAt,
        };
    }
    return null;
}

export function setupAuth(app: Express) {
    const MemoryStore = createMemoryStore(session);
    const sessionSettings: session.SessionOptions = {
        secret: process.env.SESSION_SECRET || "super_secret_key_change_in_prod",
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: process.env.NODE_ENV === "production",
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
        },
        store: new MemoryStore({
            checkPeriod: 86400000 // prune expired entries every 24h
        }),
    };

    if (app.get("env") === "production") {
        app.set("trust proxy", 1); // trust first proxy
    }

    app.use(session(sessionSettings));
    app.use(passport.initialize());
    app.use(passport.session());

    passport.use(
        new LocalStrategy(async (username, password, done) => {
            try {
                const user = await verifyCredentials(username, password);
                if (!user) {
                    return done(null, false, { message: "Invalid username or password" });
                }
                return done(null, user);
            } catch (err) {
                return done(err);
            }
        }),
    );

    passport.serializeUser((user, done) => {
        done(null, (user as User).id);
    });

    passport.deserializeUser(async (id: string, done) => {
        if (id === "1") {
            const adminUser = process.env.ADMIN_USERNAME || "Admin";
            done(null, {
                id: "1",
                username: adminUser,
                role: "SuperAdmin",
                createdAt: new Date().toISOString()
            } as User);
        } else {
            try {
                const user = await storage.getUser(id);
                if (user) {
                    done(null, user);
                } else {
                    done(null, false);
                }
            } catch (err) {
                done(err);
            }
        }
    });

    app.post("/api/login", (req, res, next) => {
        passport.authenticate("local", (err: any, user: User, info: any) => {
            if (err) {
                return next(err);
            }
            if (!user) {
                return res.status(401).json({ message: info?.message || "Authentication failed" });
            }
            req.login(user, (err) => {
                if (err) {
                    return next(err);
                }
                return res.json({ message: "Login successful", user });
            });
        })(req, res, next);
    });

    app.post("/api/logout", (req, res, next) => {
        req.logout((err) => {
            if (err) {
                return next(err);
            }
            res.json({ message: "Logout successful" });
        });
    });

    app.get("/api/user", (req, res) => {
        if (req.isAuthenticated()) {
            res.json(req.user);
        } else {
            res.status(401).json({ message: "Not authenticated" });
        }
    });
}

export function ensureAuthenticated(req: any, res: any, next: any) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ message: "Not authenticated" });
}

export function requireSuperAdmin(req: any, res: any, next: any) {
    if (req.isAuthenticated() && req.user.role === "SuperAdmin") {
        return next();
    }
    res.status(403).json({ error: "Access denied. SuperAdmin role required." });
}

export function checkPermission(permission: string, action: "view" | "add" | "edit" | "delete") {
    return (req: any, res: any, next: any) => {
        if (!req.isAuthenticated()) {
            return res.status(401).json({ error: "Not authenticated" });
        }
        if (req.user.role === "SuperAdmin") {
            return next();
        }
        const permissions = req.user.permissions || {};
        if (permissions[permission]?.[action]) {
            return next();
        }
        res.status(403).json({ error: `Access denied. Requires ${permission}.${action} permission.` });
    };
}
