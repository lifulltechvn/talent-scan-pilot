"""Keyword normalization: map skill aliases to canonical names before matching."""

# Static mapping of common aliases → canonical skill names
SKILL_ALIASES = {
    # JavaScript ecosystem
    "js": "JavaScript", "javascript": "JavaScript", "es6": "JavaScript",
    "ts": "TypeScript", "typescript": "TypeScript",
    "react.js": "React", "reactjs": "React", "react js": "React",
    "vue.js": "Vue.js", "vuejs": "Vue.js",
    "next.js": "Next.js", "nextjs": "Next.js",
    "node.js": "Node.js", "nodejs": "Node.js", "node": "Node.js",
    "express.js": "Express", "expressjs": "Express",
    # Python
    "python3": "Python", "py": "Python",
    "fastapi": "FastAPI", "fast api": "FastAPI",
    "django": "Django", "flask": "Flask",
    # DevOps
    "k8s": "Kubernetes", "kube": "Kubernetes",
    "docker-compose": "Docker", "docker compose": "Docker",
    "aws": "AWS", "amazon web services": "AWS", "aws or cloud services": "AWS",
    "cloud services": "AWS", "cloud": "AWS",
    "gcp": "Google Cloud", "google cloud platform": "Google Cloud",
    "ci/cd": "CI/CD", "cicd": "CI/CD", "ci cd": "CI/CD",
    # Databases
    "postgres": "PostgreSQL", "postgresql": "PostgreSQL", "pg": "PostgreSQL",
    "postgresql/mysql": "PostgreSQL", "mysql/postgresql": "PostgreSQL",
    "mysql": "MySQL", "mongo": "MongoDB", "mongodb": "MongoDB",
    "redis": "Redis",
    # Frontend
    "tailwind": "TailwindCSS", "tailwindcss": "TailwindCSS", "tailwind css": "TailwindCSS",
    "css3": "CSS", "html5": "HTML",
    # Other
    "git": "Git", "github": "Git",
    "rest api": "REST API", "restful": "REST API", "rest": "REST API",
    "rest api design": "REST API", "api development": "REST API", "api design": "REST API",
    "graphql": "GraphQL",
    "linux": "Linux", "ubuntu": "Linux",
    "agile": "Agile", "scrum": "Agile",
    # PHP
    "php 7.4+": "PHP", "php 8": "PHP", "php8": "PHP", "php7": "PHP",
    # Soft equivalents
    "fullstack development": "Full-stack", "full-stack development": "Full-stack",
    "frontend development": "Frontend", "front-end development": "Frontend",
    "backend development": "Backend", "back-end development": "Backend",
    "system architecture": "Architecture", "software architecture": "Architecture",
    "database design": "Database Design", "db design": "Database Design",
}


def normalize_skill(skill: str) -> str:
    """Normalize a single skill name to canonical form."""
    key = skill.lower().strip()
    return SKILL_ALIASES.get(key, skill.strip())


def normalize_skills(skills: list[str]) -> list[str]:
    """Normalize a list of skills, deduplicate."""
    seen = set()
    result = []
    for s in skills:
        normalized = normalize_skill(s)
        key = normalized.lower()
        if key not in seen:
            seen.add(key)
            result.append(normalized)
    return result
