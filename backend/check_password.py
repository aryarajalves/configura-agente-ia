import bcrypt

password = "admin"
hash = "$2b$12$iE9I3PsrbW3MwP1qmImaYuvtpD5Y.BMPpg8P1ivU2mXMjAsMz6BDq"

if bcrypt.checkpw(password.encode('utf-8'), hash.encode('utf-8')):
    print("Match!")
else:
    print("No match!")
