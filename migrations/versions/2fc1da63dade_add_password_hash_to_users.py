from alembic import op
import sqlalchemy as sa

revision = '2fc1da63dade'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    op.create_table('users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('age', sa.Integer(), nullable=False),
        sa.Column('gender', sa.Enum('MALE', 'FEMALE', name='genderenum'), nullable=False),
        sa.Column('county', sa.String(length=100), nullable=False),
        sa.Column('town', sa.String(length=100), nullable=False),
        sa.Column('phone_number', sa.String(length=20), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=True),
        sa.Column('profile_picture', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('phone_number')
    )
    op.create_table('user_details',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('education_level', sa.String(length=100), nullable=True),
        sa.Column('profession', sa.String(length=100), nullable=True),
        sa.Column('marital_status', sa.String(length=50), nullable=True),
        sa.Column('religion', sa.String(length=50), nullable=True),
        sa.Column('ethnicity', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id')
    )
    op.create_table('user_descriptions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id')
    )
    op.create_table('match_requests',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('age_range_min', sa.Integer(), nullable=False),
        sa.Column('age_range_max', sa.Integer(), nullable=False),
        sa.Column('town', sa.String(length=100), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_table('match_results',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('match_request_id', sa.Integer(), nullable=False),
        sa.Column('matched_user_id', sa.Integer(), nullable=False),
        sa.Column('result_order', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['match_request_id'], ['match_requests.id']),
        sa.ForeignKeyConstraint(['matched_user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_table('interest_requests',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('requester_user_id', sa.Integer(), nullable=False),
        sa.Column('target_user_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['requester_user_id'], ['users.id']),
        sa.ForeignKeyConstraint(['target_user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_table('consent_responses',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('interest_request_id', sa.Integer(), nullable=False),
        sa.Column('responder_user_id', sa.Integer(), nullable=False),
        sa.Column('response', sa.String(length=10), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['interest_request_id'], ['interest_requests.id']),
        sa.ForeignKeyConstraint(['responder_user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('interest_request_id')
    )
    op.create_table('sms_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('direction', sa.String(length=10), nullable=False),
        sa.Column('sender', sa.String(length=20), nullable=False),
        sa.Column('recipient', sa.String(length=20), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('shortcode', sa.String(length=20), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_table('sms_outbox',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('recipient', sa.String(length=20), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('sender_id', sa.String(length=20), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('sent_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

def downgrade():
    op.drop_table('sms_outbox')
    op.drop_table('sms_logs')
    op.drop_table('consent_responses')
    op.drop_table('interest_requests')
    op.drop_table('match_results')
    op.drop_table('match_requests')
    op.drop_table('user_descriptions')
    op.drop_table('user_details')
    op.drop_table('users')