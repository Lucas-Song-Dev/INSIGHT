from flask import Blueprint, render_template
from flask_restful import Api
from api import (
    HealthCheck, Register, Login, Logout, ScrapePosts, Recommendations,
    GetPainPoints, GetPosts, GetStatus, ResetScrapeStatus,
    GetClaudeAnalysis, GetAllProducts, RunAnalysis,
    GetUserProfile, UpdateUserCredits, DeleteAccount,
    RequestPasswordReset, ResetPassword, ChangePassword,
    GetUserJobs, GetJobDetails, GetAnalytics, CancelJob
)

# Create blueprint for main routes
main_bp = Blueprint('main', __name__)

@main_bp.route('/')
def index():
    """Render the admin dashboard page"""
    return render_template('index.html')

def initialize_routes(api):
    """Initialize all API routes."""
    api.add_resource(HealthCheck, '/api/health')
    api.add_resource(Register, '/api/register')
    api.add_resource(Login, '/api/login')
    api.add_resource(Logout, '/api/logout')
    api.add_resource(ScrapePosts, '/api/scrape')
    api.add_resource(Recommendations, '/api/recommendations')
    api.add_resource(GetPainPoints, '/api/pain-points')
    api.add_resource(GetPosts, '/api/posts')
    api.add_resource(GetStatus, '/api/status')
    api.add_resource(ResetScrapeStatus, '/api/reset-status')
    api.add_resource(GetClaudeAnalysis, '/api/claude-analysis')
    api.add_resource(GetAllProducts, '/api/all-products')
    api.add_resource(RunAnalysis, '/api/run-analysis')
    api.add_resource(GetUserProfile, '/api/user/profile')
    api.add_resource(UpdateUserCredits, '/api/user/credits')
    api.add_resource(DeleteAccount, '/api/user')
    api.add_resource(RequestPasswordReset, '/api/password/reset-request')
    api.add_resource(ResetPassword, '/api/password/reset')
    api.add_resource(ChangePassword, '/api/user/password')
    api.add_resource(GetUserJobs, '/api/jobs')
    api.add_resource(GetJobDetails, '/api/jobs/<job_id>')
    api.add_resource(CancelJob, '/api/jobs/<job_id>/cancel')
    api.add_resource(GetAnalytics, '/api/analytics')
