CREATE TABLE users (
    id INT NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    age INT NOT NULL,
    gender VARCHAR(20) NOT NULL,
    county VARCHAR(100) NOT NULL,
    town VARCHAR(100) NOT NULL,
    phone_number VARCHAR(20) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);

CREATE TABLE user_details (
    id INT NOT NULL AUTO_INCREMENT,
    user_id INT NOT NULL,
    education_level VARCHAR(100),
    profession VARCHAR(100),
    marital_status VARCHAR(50),
    religion VARCHAR(50),
    ethnicity VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE user_descriptions (
    id INT NOT NULL AUTO_INCREMENT,
    user_id INT NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE match_requests (
    id INT NOT NULL AUTO_INCREMENT,
    user_id INT NOT NULL,
    age_range_min INT NOT NULL,
    age_range_max INT NOT NULL,
    town VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE match_results (
    id INT NOT NULL AUTO_INCREMENT,
    match_request_id INT NOT NULL,
    matched_user_id INT NOT NULL,
    result_order INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (match_request_id) REFERENCES match_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (matched_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE interest_requests (
    id INT NOT NULL AUTO_INCREMENT,
    requester_user_id INT NOT NULL,
    target_user_id INT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE (requester_user_id, target_user_id),
    FOREIGN KEY (requester_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE consent_responses (
    id INT NOT NULL AUTO_INCREMENT,
    interest_request_id INT NOT NULL,
    responder_user_id INT NOT NULL,
    response VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE (interest_request_id),
    FOREIGN KEY (interest_request_id) REFERENCES interest_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (responder_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE sms_logs (
    id INT NOT NULL AUTO_INCREMENT,
    direction VARCHAR(10) NOT NULL,
    sender VARCHAR(20) NOT NULL,
    recipient VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    shortcode VARCHAR(20),
    status VARCHAR(20) DEFAULT 'received',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);

CREATE TABLE sms_outbox (
    id INT NOT NULL AUTO_INCREMENT,
    recipient VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    sender_id VARCHAR(20) DEFAULT '22141',
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (id)
);
