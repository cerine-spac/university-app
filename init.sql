CREATE TABLE departments(
id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
code VARCHAR(50) UNIQUE NOT NULL ,
name VARCHAR(100) NOT NULL 
);
CREATE TABLE announcements (
id SERIAL PRIMARY KEY,
title VARCHAR(200) NOT NULL,
content TEXT NOT NULL,
department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE admins (
id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
email VARCHAR(150) UNIQUE NOT NULL,
password_hash TEXT NOT NULL
);
INSERT INTO departments (code, name) VALUES
('informatique', 'Informatique'),
('biologie', 'Biologie'),
('chimie', 'Chimie'),
('agronomie', 'Agronomie'),
('physique', 'Physique'),
('mathematiques', 'Mathematiques');
