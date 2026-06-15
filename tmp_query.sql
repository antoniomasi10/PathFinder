SELECT email, u.gpa, u."englishLevel", u."willingToRelocate", u."yearOfStudy", u."courseOfStudy", up."primaryInterest", up."clusterTag", up.passions
FROM "User" u
LEFT JOIN "UserProfile" up ON up."userId" = u.id
ORDER BY u."createdAt" DESC
LIMIT 20;
