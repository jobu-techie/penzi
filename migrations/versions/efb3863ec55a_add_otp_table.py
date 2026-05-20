"""add otp table

Revision ID: efb3863ec55a
Revises: 0ecfbb3de6c8
Create Date: 2026-05-14 14:34:10.603340

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'efb3863ec55a'
down_revision = '0ecfbb3de6c8'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'otps',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('code', sa.String(length=6), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('used', sa.Boolean(), nullable=False),
        sa.Column('attempts', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_otps_user_id'), 'otps', ['user_id'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_otps_user_id'), table_name='otps')
    op.drop_table('otps')
